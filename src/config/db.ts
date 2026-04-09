import mongoose from 'mongoose';
import env from './env.js';
import logger from './logger.js';
import QueueJobLog from '../models/queueJobLog.model.js';
import Video from '../models/video.model.js';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  logger.info('MongoDB connected');
  await Video.syncIndexes();
  await QueueJobLog.syncIndexes();
}
