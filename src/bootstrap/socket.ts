import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { setIo } from '../socket/socketRegistry.js';

export function setupSocket(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected: %s', socket.id);

    socket.on('subscribe:video', (videoId: string) => {
      socket.join(`video:${videoId}`);
    });

    socket.on('subscribe:job', (jobId: string) => {
      if (typeof jobId === 'string' && jobId.length > 0 && jobId.length < 200) {
        socket.join(`job:${jobId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected: %s', socket.id);
    });
  });

  setIo(io);
  return io;
}
