import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';

export type VideoJobUpdatePayload = {
  jobId: string;
  tenantId: string;
  status: string;
  /** 0–100 approximate stage progress for UI */
  progress: number;
  errorMessage?: string | null;
};

export async function publishLifecycleEvent(
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const channel = await getRabbitChannel();
  const body = Buffer.from(JSON.stringify({ type, payload }));
  const ok = channel.sendToQueue(env.RABBITMQ_VIDEO_EVENTS_QUEUE, body, {
    persistent: true
  });
  if (!ok) {
    logger.warn('Lifecycle event queue buffer full; type=%s not forwarded', type);
  }
}

export async function publishVideoUploadedEvent(payload: Record<string, unknown>): Promise<void> {
  await publishLifecycleEvent('video:uploaded', payload);
}

export async function publishVideoJobUpdateEvent(payload: VideoJobUpdatePayload): Promise<void> {
  await publishLifecycleEvent('video:job:update', payload as Record<string, unknown>);
}
