import http from 'node:http';
import app from './app.js';
import { startLifecycleEventConsumer } from './bootstrap/lifecycleEventConsumer.js';
import { setupSocket } from './bootstrap/socket.js';
import { connectMongo } from './config/db.js';
import env from './config/env.js';
import logger from './config/logger.js';
import { getRabbitChannel } from './config/rabbitmq.js';

async function start(): Promise<void> {
  await connectMongo();
  await getRabbitChannel();

  const server = http.createServer(app);
  setupSocket(server);
  await startLifecycleEventConsumer();

  server.listen(env.API_PORT, () => {
    logger.info('API server listening on port %d', env.API_PORT);
  });
}

start().catch((error: Error) => {
  logger.error('Failed to start API server: %s', error.message);
  process.exit(1);
});
