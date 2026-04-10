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
        const io = getIo();
        if (!io) {
          channel.ack(message);
          return;
        }

        if (body.type === 'video:uploaded' && body.payload) {
          io.emit('video:uploaded', body.payload);
          const p = body.payload as { videoId?: unknown; tenantId?: unknown };
          const jid = p.videoId != null ? String(p.videoId) : '';
          if (jid) {
            io.to(`job:${jid}`).emit('video:job:update', {
              jobId: jid,
              tenantId: p.tenantId,
              status: 'completed',
              progress: 100,
              videoId: p.videoId,
              s3Url: (body.payload as { s3Url?: string }).s3Url,
              processingStatus: (body.payload as { processingStatus?: string }).processingStatus,
              sensitivityStatus: (body.payload as { sensitivityStatus?: string }).sensitivityStatus
            });
          }
        } else if (body.type === 'video:job:update' && body.payload) {
          const p = body.payload as { jobId?: unknown };
          const jobId = p.jobId != null ? String(p.jobId) : '';
          if (jobId) {
            io.to(`job:${jobId}`).emit('video:job:update', body.payload);
          }
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
