import mongoose from 'mongoose';
import env from './env.js';
import logger from './logger.js';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  logger.info('MongoDB connected');
}
