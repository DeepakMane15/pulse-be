import env from '../config/env.js';
import { getRabbitChannel } from '../config/rabbitmq.js';
import ApiError from '../lib/ApiError.js';
import type { VideoAnalyzeQueuePayload } from '../types/queueJob.js';

export async function publishVideoAnalyzeJob(
  payload: VideoAnalyzeQueuePayload
): Promise<void> {
  const channel = await getRabbitChannel();
  const body = Buffer.from(JSON.stringify(payload));
  const ok = channel.sendToQueue(env.RABBITMQ_VIDEO_ANALYZE_QUEUE, body, {
    persistent: true
  });
  if (!ok) {
    throw new ApiError(503, 'Analyze queue is saturated; try again shortly');
  }
}
