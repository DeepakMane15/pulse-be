import type { ConsumeMessage } from 'amqplib';
import env from '../config/env.js';
import logger from '../config/logger.js';
import {
  createWorkerConsumerChannels,
  getRabbitChannel
} from '../config/rabbitmq.js';
import { handleVideoAnalyzeQueueMessage } from '../services/videoUploadJob.service.js';

export async function startConsumers(): Promise<void> {
  await getRabbitChannel();
  const { analyzeChannel } = await createWorkerConsumerChannels();

  await analyzeChannel.consume(
    env.RABBITMQ_VIDEO_ANALYZE_QUEUE,
    async (message: ConsumeMessage | null) => {
      if (!message) return;
      const raw = message.content.toString('utf8');
      try {
        await handleVideoAnalyzeQueueMessage(raw);
        analyzeChannel.ack(message);
      } catch (error: any) {
        logger.error(`Analyze consumer failed: ${error.message}`);
        analyzeChannel.nack(message, false, false);
      }
    }
  );

  logger.info('RabbitMQ consumer started (video analyze pipeline: S3 + Rekognition + Video row)');
}
