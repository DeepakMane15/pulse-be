import type { ConsumeMessage } from 'amqplib';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';
import { getIo } from '../socket/socketRegistry.js';

export async function startLifecycleEventConsumer(): Promise<void> {
  const channel = await getRabbitChannel();
  channel.prefetch(50);

  await channel.consume(
    env.RABBITMQ_VIDEO_EVENTS_QUEUE,
    (message: ConsumeMessage | null) => {
      if (!message) return;

      try {
        const body = JSON.parse(message.content.toString('utf8')) as {
          type?: string;
          payload?: Record<string, unknown>;
        };
        if (body.type === 'video:uploaded' && body.payload) {
          getIo()?.emit('video:uploaded', body.payload);
        }
        channel.ack(message);
      } catch (error: any) {
        logger.error('Lifecycle event consumer error: %s', error.message);
        channel.nack(message, false, false);
      }
    }
  );

  logger.info(
    'Lifecycle event consumer started on %s',
    env.RABBITMQ_VIDEO_EVENTS_QUEUE
  );
}
