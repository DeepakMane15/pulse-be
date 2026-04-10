import amqp from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import env from './env.js';
import logger from './logger.js';

let connection: ChannelModel | null = null;
let publishChannel: Channel | null = null;
const CONNECT_RETRY_ATTEMPTS = 15;
const CONNECT_RETRY_DELAY_MS = 2000;

/** Longer default helps when the debugger pauses the process (missed heartbeats drop the connection). */
const AMQP_HEARTBEAT_SEC = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function openConnection(): Promise<ChannelModel> {
  return amqp.connect(env.RABBITMQ_URL, { heartbeat: AMQP_HEARTBEAT_SEC });
}

export async function getRabbitConnection(): Promise<ChannelModel> {
  if (connection) return connection;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CONNECT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      logger.info(
        'Connecting to RabbitMQ (attempt %d/%d)',
        attempt,
        CONNECT_RETRY_ATTEMPTS
      );

      const nextConnection = await openConnection();
      nextConnection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error: %s', err.message);
      });
      nextConnection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        publishChannel = null;
        connection = null;
      });
      connection = nextConnection;
      logger.info('RabbitMQ connection ready (heartbeat=%ds)', AMQP_HEARTBEAT_SEC);
      return nextConnection;
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

/**
 * Channel used for publishing and (on the API) lifecycle consume.
 * Worker job handlers publish via this channel.
 */
export async function getRabbitChannel(): Promise<Channel> {
  if (publishChannel) return publishChannel;

  const conn = await getRabbitConnection();
  const nextChannel = await conn.createChannel();
  await nextChannel.assertQueue(env.RABBITMQ_VIDEO_ANALYZE_QUEUE, { durable: true });
  await nextChannel.assertQueue(env.RABBITMQ_VIDEO_UPLOAD_QUEUE, { durable: true });
  await nextChannel.assertQueue(env.RABBITMQ_VIDEO_EVENTS_QUEUE, {
    durable: true
  });
  publishChannel = nextChannel;

  logger.info(
    'RabbitMQ publish channel ready (analyze=%s upload=%s events=%s)',
    env.RABBITMQ_VIDEO_ANALYZE_QUEUE,
    env.RABBITMQ_VIDEO_UPLOAD_QUEUE,
    env.RABBITMQ_VIDEO_EVENTS_QUEUE
  );
  return publishChannel;
}

/** Worker only: single consumer for upload + Rekognition + DB finalize (long-running jobs). */
export async function createWorkerConsumerChannels(): Promise<{
  analyzeChannel: Channel;
}> {
  const conn = await getRabbitConnection();

  const analyzeChannel = await conn.createChannel();
  analyzeChannel.on('error', (err: Error) => {
    logger.error('RabbitMQ analyze consumer channel error: %s', err.message);
  });
  await analyzeChannel.assertQueue(env.RABBITMQ_VIDEO_ANALYZE_QUEUE, { durable: true });
  analyzeChannel.prefetch(1);

  logger.info('RabbitMQ worker consumer channel ready (analyze prefetch=1)');

  return { analyzeChannel };
}
