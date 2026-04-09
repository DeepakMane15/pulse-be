import mongoose from 'mongoose';
import env from './env.js';
import logger from './logger.js';
import Video from '../models/video.model.js';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  logger.info('MongoDB connected');
  // Drops indexes removed from the schema (e.g. legacy s3Key_1 after switching to s3Url).
  await Video.syncIndexes();
}
