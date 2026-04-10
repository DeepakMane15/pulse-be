import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import {
  buildS3ObjectUrl,
  copyS3ObjectWithinBucket,
  deleteS3Object,
  uploadStreamToS3
} from '../lib/s3.js';
import { generateAndStoreVideoPoster } from '../lib/videoPoster.js';
import { classifyVideoModerationFromS3 } from '../lib/rekognition.js';
import QueueJobLog from '../models/queueJobLog.model.js';
import Video from '../models/video.model.js';
import {
  publishVideoJobUpdateEvent,
  publishVideoUploadedEvent
} from '../queue/videoLifecycle.publisher.js';
import { publishVideoS3UploadJob } from '../queue/videoS3Upload.publisher.js';
import type { SensitivityStatus } from '../types/video.js';
import {
  videoAnalyzeQueuePayloadSchema,
  videoS3UploadQueuePayloadSchema,
  type VideoAnalyzeQueuePayload,
  type VideoS3UploadQueuePayload
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

  let stagingS3Key: string | null = null;

  try {
    await fs.access(payload.tempFilePath);

    const safeName = sanitizeName(payload.originalName);
    stagingS3Key = `staging/${payload.tenantId}/${payload.jobLogId}/${Date.now()}-${safeName}`;

    const stream = createReadStream(payload.tempFilePath);
    await uploadStreamToS3({
      key: stagingS3Key,
      body: stream,
      contentType: payload.mimeType
    });

    await removeTempFile(payload.tempFilePath);

    const moderation = await classifyVideoModerationFromS3(stagingS3Key);

    if (moderation === 'flagged') {
      await deleteS3Object(stagingS3Key).catch(() => {});
      await QueueJobLog.findByIdAndUpdate(jobLogId, {
        status: 'failed',
        errorMessage: 'Video blocked by content moderation (Rekognition)'
      });
      await publishVideoJobUpdateEvent({
        jobId: jobLogId.toString(),
        tenantId: payload.tenantId,
        status: 'failed',
        progress: 0,
        errorMessage: 'Video blocked by content moderation (Rekognition)'
      });
      return;
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

    await publishVideoS3UploadJob({
      jobLogId: payload.jobLogId,
      tenantId: payload.tenantId,
      uploadedBy: payload.uploadedBy,
      title: payload.title,
      description: payload.description,
      originalName: payload.originalName,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      stagingS3Key
    });
  } catch (error: any) {
    logger.error('Video analyze job failed: %s', error.message);
    if (stagingS3Key) {
      await deleteS3Object(stagingS3Key).catch(() => {});
    }
    await removeTempFile(payload.tempFilePath);
    const log = await QueueJobLog.findById(jobLogId);
    if (log && !['failed', 'completed'].includes(log.status)) {
      await QueueJobLog.findByIdAndUpdate(jobLogId, {
        status: 'failed',
        errorMessage: error.message || 'Analyze job failed'
      });
      await publishVideoJobUpdateEvent({
        jobId: jobLogId.toString(),
        tenantId: payload.tenantId,
        status: 'failed',
        progress: 0,
        errorMessage: error.message || 'Analyze job failed'
      });
    }
    throw error;
  }
}

export async function handleVideoS3UploadQueueMessage(raw: string): Promise<void> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    logger.error('Video S3 upload job: invalid JSON payload');
    return;
  }

  const parsed = videoS3UploadQueuePayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.error('Video S3 upload job: schema validation failed');
    return;
  }

  const payload: VideoS3UploadQueuePayload = parsed.data;

  let jobLogId: mongoose.Types.ObjectId;
  try {
    jobLogId = new mongoose.Types.ObjectId(payload.jobLogId);
  } catch {
    logger.error('Video S3 upload job: invalid jobLogId');
    await deleteS3Object(payload.stagingS3Key).catch(() => {});
    return;
  }

  const existing = await QueueJobLog.findById(jobLogId);
  if (!existing) {
    logger.warn('Video S3 upload job: unknown jobLogId %s', payload.jobLogId);
    await deleteS3Object(payload.stagingS3Key).catch(() => {});
    return;
  }

  if (existing.status === 'completed') {
    await deleteS3Object(payload.stagingS3Key).catch(() => {});
    return;
  }

  if (existing.status !== 'uploading') {
    logger.warn(
      'Video S3 upload job: expected status uploading, got %s',
      existing.status
    );
    await deleteS3Object(payload.stagingS3Key).catch(() => {});
    return;
  }

  const videoId = jobLogId;
  const safeName = sanitizeName(payload.originalName);
  const finalKey = `${payload.tenantId}/${videoId.toString()}/${safeName}`;

  const sensitivityStatus: SensitivityStatus = 'safe';

  try {
    await copyS3ObjectWithinBucket({
      sourceKey: payload.stagingS3Key,
      destinationKey: finalKey
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
        await deleteS3Object(payload.stagingS3Key).catch(() => {});
        return;
      }
      await deleteS3Object(finalKey).catch(() => {});
      await deleteS3Object(payload.stagingS3Key).catch(() => {});
      throw createErr;
    }

    await deleteS3Object(payload.stagingS3Key).catch(() => {});

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
    logger.error('Video S3 upload job failed: %s', error.message);
    await QueueJobLog.findByIdAndUpdate(jobLogId, {
      status: 'failed',
      errorMessage: error.message || 'S3 finalize failed'
    });
    await publishVideoJobUpdateEvent({
      jobId: jobLogId.toString(),
      tenantId: payload.tenantId,
      status: 'failed',
      progress: 0,
      errorMessage: error.message || 'S3 finalize failed'
    });
    await deleteS3Object(payload.stagingS3Key).catch(() => {});
    throw error;
  }
}
