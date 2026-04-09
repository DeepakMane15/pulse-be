import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';

export async function publishVideoUploadedEvent(payload: Record<string, unknown>): Promise<void> {
  const channel = await getRabbitChannel();
  const body = Buffer.from(
    JSON.stringify({ type: 'video:uploaded', payload })
  );
  const ok = channel.sendToQueue(env.RABBITMQ_VIDEO_EVENTS_QUEUE, body, {
    persistent: true
  });
  if (!ok) {
    logger.warn('Lifecycle event queue buffer full; video:uploaded not forwarded');
  }
}
