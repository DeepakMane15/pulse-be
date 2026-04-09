import { startConsumers } from '../bootstrap/rabbitConsumers.js';
import { connectMongo } from '../config/db.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';

async function startWorker(): Promise<void> {
  await connectMongo();
  await getRabbitChannel();
  await startConsumers();
  logger.info('Worker started on queue %s', env.RABBITMQ_VIDEO_QUEUE);
}

startWorker().catch((error: Error) => {
  logger.error('Failed to start worker: %s', error.message);
  process.exit(1);
});
