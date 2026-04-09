import amqp from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import env from './env.js';
import logger from './logger.js';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
const CONNECT_RETRY_ATTEMPTS = 15;
const CONNECT_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CONNECT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      logger.info(
        'Connecting to RabbitMQ (attempt %d/%d)',
        attempt,
        CONNECT_RETRY_ATTEMPTS
      );

      const nextConnection = await amqp.connect(env.RABBITMQ_URL);
      nextConnection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error: %s', err.message);
      });
      nextConnection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        channel = null;
        connection = null;
      });
      connection = nextConnection;

      const nextChannel = await connection.createChannel();
      await nextChannel.assertQueue(env.RABBITMQ_VIDEO_QUEUE, { durable: true });
      await nextChannel.assertQueue(env.RABBITMQ_VIDEO_EVENTS_QUEUE, {
        durable: true
      });
      channel = nextChannel;

      logger.info('RabbitMQ channel ready on queue %s', env.RABBITMQ_VIDEO_QUEUE);
      return nextChannel;
    } catch (error: any) {
      lastError = error;
      logger.error(
        'RabbitMQ connect attempt %d failed: %s',
        attempt,
        error.message
      );

      if (attempt < CONNECT_RETRY_ATTEMPTS) {
        await sleep(CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Failed to connect to RabbitMQ after ${CONNECT_RETRY_ATTEMPTS} attempts: ${lastError?.message || 'Unknown error'}`
  );
}
