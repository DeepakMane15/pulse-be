import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { buildS3ObjectUrl, deleteS3Object, uploadStreamToS3 } from '../lib/s3.js';
import { generateAndStoreVideoPoster } from '../lib/videoPoster.js';
import { classifyVideoModerationFromS3 } from '../lib/rekognition.js';
import QueueJobLog from '../models/queueJobLog.model.js';
import Video from '../models/video.model.js';
import {
  publishVideoJobUpdateEvent,
  publishVideoUploadedEvent
} from '../queue/videoLifecycle.publisher.js';
import type { SensitivityStatus } from '../types/video.js';
import {
  videoAnalyzeQueuePayloadSchema,
  type VideoAnalyzeQueuePayload
} from '../types/queueJob.js';

function sanitizeName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function removeTempFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {
    /* already gone or permission */
  });
}

export async function handleVideoAnalyzeQueueMessage(raw: string): Promise<void> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    logger.error('Video analyze job: invalid JSON payload');
    return;
  }

  const parsed = videoAnalyzeQueuePayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.error('Video analyze job: schema validation failed');
    return;
  }

  const payload: VideoAnalyzeQueuePayload = parsed.data;

  let jobLogId: mongoose.Types.ObjectId;
  try {
    jobLogId = new mongoose.Types.ObjectId(payload.jobLogId);
  } catch {
    logger.error('Video analyze job: invalid jobLogId');
    await removeTempFile(payload.tempFilePath);
    return;
  }

  const videoId = jobLogId;
  const safeName = sanitizeName(payload.originalName);
  const finalKey = `${payload.tenantId}/${videoId.toString()}/${safeName}`;

  const existing = await QueueJobLog.findById(jobLogId);
  if (!existing) {
    logger.warn('Video analyze job: unknown jobLogId %s', payload.jobLogId);
    await removeTempFile(payload.tempFilePath);
    return;
  }

  if (existing.status === 'completed') {
    await removeTempFile(payload.tempFilePath);
    return;
  }

  if (['analyzing', 'uploading'].includes(existing.status)) {
    await removeTempFile(payload.tempFilePath);
    return;
  }

  const locked = await QueueJobLog.findOneAndUpdate(
    { _id: jobLogId, status: 'pending' },
    { status: 'analyzing', errorMessage: null },
    { returnDocument: 'after' }
  );

  if (!locked) {
    await removeTempFile(payload.tempFilePath);
    return;
  }

  await publishVideoJobUpdateEvent({
    jobId: jobLogId.toString(),
    tenantId: payload.tenantId,
    status: 'analyzing',
    progress: 30,
    errorMessage: null
  });

  let uploadedToFinal = false;

  try {
    await fs.access(payload.tempFilePath);

    const stream = createReadStream(payload.tempFilePath);
    await uploadStreamToS3({
      key: finalKey,
      body: stream,
      contentType: payload.mimeType
    });
    uploadedToFinal = true;

    await removeTempFile(payload.tempFilePath);

    let sensitivityStatus: SensitivityStatus = 'pending';
    try {
      sensitivityStatus = await classifyVideoModerationFromS3(finalKey);
    } catch (modErr: any) {
      logger.error(
        'Rekognition error; video kept with sensitivity=pending: %s',
        modErr.message
      );
      sensitivityStatus = 'pending';
    }

    if (sensitivityStatus === 'flagged') {
      logger.info(
        'Content classified as flagged; keeping object key=%s (job=%s)',
        finalKey,
        jobLogId.toString()
      );
    }

    await QueueJobLog.findByIdAndUpdate(jobLogId, {
      status: 'uploading',
      errorMessage: null
    });

    await publishVideoJobUpdateEvent({
      jobId: jobLogId.toString(),
      tenantId: payload.tenantId,
      status: 'uploading',
      progress: 70,
      errorMessage: null
    });

    const s3Url = buildS3ObjectUrl(finalKey);

    try {
      await Video.create({
        _id: videoId,
        tenantId: payload.tenantId,
        uploadedBy: payload.uploadedBy,
        title: payload.title,
        description: payload.description,
        fileName: payload.originalName,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        s3Url,
        processingStatus: 'uploaded',
        sensitivityStatus
      });
    } catch (createErr: any) {
      if (createErr?.code === 11000) {
        await deleteS3Object(finalKey).catch(() => {});
        return;
      }
      await deleteS3Object(finalKey).catch(() => {});
      throw createErr;
    }

    const posterKey = `${payload.tenantId}/${videoId.toString()}/poster.jpg`;
    const thumbnailUrl = await generateAndStoreVideoPoster(finalKey, posterKey);
    if (thumbnailUrl) {
      await Video.findByIdAndUpdate(videoId, { thumbnailUrl });
    }

    await QueueJobLog.findByIdAndUpdate(jobLogId, {
      status: 'completed',
      errorMessage: null
    });

    const video = await Video.findById(videoId).lean();
    if (video) {
      await publishVideoUploadedEvent({
        videoId: video._id,
        tenantId: video.tenantId,
        s3Url: video.s3Url,
        thumbnailUrl: video.thumbnailUrl,
        processingStatus: video.processingStatus,
        sensitivityStatus: video.sensitivityStatus
      });
    }
  } catch (error: any) {
    logger.error('Video analyze job failed: %s', error.message);
    if (uploadedToFinal) {
      await deleteS3Object(finalKey).catch(() => {});
    }
    await removeTempFile(payload.tempFilePath);
    const log = await QueueJobLog.findById(jobLogId);
    if (log && !['failed', 'completed'].includes(log.status)) {
      await QueueJobLog.findByIdAndUpdate(jobLogId, {
        status: 'failed',
        errorMessage: error.message || 'Upload job failed'
      });
      await publishVideoJobUpdateEvent({
        jobId: jobLogId.toString(),
        tenantId: payload.tenantId,
        status: 'failed',
        progress: 0,
        errorMessage: error.message || 'Upload job failed'
      });
    }
    throw error;
  }
}
