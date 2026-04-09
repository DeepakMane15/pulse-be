import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { buildS3ObjectUrl, uploadStreamToS3 } from '../lib/s3.js';
import QueueJobLog from '../models/queueJobLog.model.js';
import Video from '../models/video.model.js';
import { publishVideoUploadedEvent } from '../queue/videoLifecycle.publisher.js';
import type { SensitivityStatus } from '../types/video.js';
import {
  videoUploadQueuePayloadSchema,
  type VideoUploadQueuePayload
} from '../types/queueJob.js';

function sanitizeName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function removeTempFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {
    /* already gone or permission */
  });
}

export async function handleVideoUploadQueueMessage(
  raw: string
): Promise<void> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    logger.error('Video upload job: invalid JSON payload');
    return;
  }

  const parsed = videoUploadQueuePayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.error('Video upload job: schema validation failed');
    return;
  }

  const payload: VideoUploadQueuePayload = parsed.data;

  let jobLogId: mongoose.Types.ObjectId;
  try {
    jobLogId = new mongoose.Types.ObjectId(payload.jobLogId);
  } catch {
    logger.error('Video upload job: invalid jobLogId');
    await removeTempFile(payload.tempFilePath);
    return;
  }

  const existing = await QueueJobLog.findById(jobLogId);
  if (!existing) {
    logger.warn('Video upload job: unknown jobLogId %s', payload.jobLogId);
    await removeTempFile(payload.tempFilePath);
    return;
  }

  if (existing.status === 'completed') {
    await removeTempFile(payload.tempFilePath);
    return;
  }

  await QueueJobLog.findByIdAndUpdate(jobLogId, { status: 'processing' });

  try {
    await fs.access(payload.tempFilePath);

    // Sensitivity pipeline (future): extract frames (e.g. ffmpeg), run Rekognition or an
    // internal classifier, then branch on safe vs flagged (quarantine, block upload, notify).
    // For now we classify everything as safe so uploads always proceed.
    const sensitivityStatus: SensitivityStatus = 'safe';

    const videoId = new mongoose.Types.ObjectId();
    const safeName = sanitizeName(payload.originalName);
    const s3Key = `${payload.tenantId}/${videoId.toString()}/${Date.now()}-${safeName}`;

    const stream = createReadStream(payload.tempFilePath);
    await uploadStreamToS3({
      key: s3Key,
      body: stream,
      contentType: payload.mimeType
    });

    const s3Url = buildS3ObjectUrl(s3Key);

    const video = await Video.create({
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

    await QueueJobLog.findByIdAndUpdate(jobLogId, {
      status: 'completed',
      errorMessage: null
    });

    await removeTempFile(payload.tempFilePath);

    await publishVideoUploadedEvent({
      videoId: video._id,
      tenantId: video.tenantId,
      s3Url: video.s3Url,
      processingStatus: video.processingStatus,
      sensitivityStatus: video.sensitivityStatus
    });
  } catch (error: any) {
    logger.error('Video upload job failed: %s', error.message);
    await QueueJobLog.findByIdAndUpdate(jobLogId, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error'
    });
    await removeTempFile(payload.tempFilePath);
    throw error;
  }
}
