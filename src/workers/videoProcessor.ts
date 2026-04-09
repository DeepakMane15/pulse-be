import { startConsumers } from '../bootstrap/rabbitConsumers.js';
import { connectMongo } from '../config/db.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { getRabbitChannel } from '../config/rabbitmq.js';

// Always visible on stderr (even if Winston misconfigured); confirms the worker process started.
console.error(
  '[pulse-worker] starting pid=%s cwd=%s',
  process.pid,
  process.cwd()
);

async function startWorker(): Promise<void> {
  await connectMongo();
  await getRabbitChannel();
  await startConsumers();
  logger.info(
    'Worker started (analyze=%s upload=%s)',
    env.RABBITMQ_VIDEO_ANALYZE_QUEUE,
    env.RABBITMQ_VIDEO_UPLOAD_QUEUE
  );
}

startWorker().catch((error: Error) => {
  logger.error('Failed to start worker: %s', error.message);
  process.exit(1);
});
