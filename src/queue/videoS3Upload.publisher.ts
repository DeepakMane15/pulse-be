import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';
import type { VideoS3UploadQueuePayload } from '../types/queueJob.js';

export async function publishVideoS3UploadJob(
  payload: VideoS3UploadQueuePayload
): Promise<void> {
  const channel = await getRabbitChannel();
  const body = Buffer.from(JSON.stringify(payload));
  const ok = channel.sendToQueue(env.RABBITMQ_VIDEO_UPLOAD_QUEUE, body, {
    persistent: true
  });
  if (!ok) {
    logger.error('Upload queue saturated; jobLogId=%s', payload.jobLogId);
    throw new Error('Upload queue is saturated');
  }
}
