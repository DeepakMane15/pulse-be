import type { ConsumeMessage } from 'amqplib';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';
import { handleVideoUploadQueueMessage } from '../services/videoUploadJob.service.js';

export async function startConsumers(): Promise<void> {
  const channel = await getRabbitChannel();
  channel.prefetch(1);

  await channel.consume(env.RABBITMQ_VIDEO_QUEUE, async (message: ConsumeMessage | null) => {
    if (!message) return;

    const raw = message.content.toString('utf8');

    try {
      await handleVideoUploadQueueMessage(raw);
      channel.ack(message);
    } catch (error: any) {
      logger.error(`Consumer failed: ${error.message}`);
      channel.nack(message, false, false);
    }
  });

  logger.info('RabbitMQ consumers started');
}
