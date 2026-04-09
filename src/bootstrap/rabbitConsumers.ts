import type { ConsumeMessage } from 'amqplib';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';

export async function startConsumers(): Promise<void> {
  const channel = await getRabbitChannel();
  channel.prefetch(1);

  await channel.consume(env.RABBITMQ_VIDEO_QUEUE, async (message: ConsumeMessage | null) => {
    if (!message) return;

    try {
      // TODO: Implement video processing logic
      channel.ack(message);
    } catch (error: any) {
      logger.error(`Consumer failed: ${error.message}`);
      channel.nack(message, false, false);
    }
  });

  logger.info('RabbitMQ consumers started');
}
