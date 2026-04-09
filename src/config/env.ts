import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function resolveWritableVideoUploadDir(candidate: string): string {
  try {
    fs.mkdirSync(candidate, { recursive: true });
    fs.accessSync(candidate, fs.constants.W_OK);
    return candidate;
  } catch (err: any) {
    const nonProd = process.env.NODE_ENV !== 'production';
    if (nonProd && (err?.code === 'EACCES' || err?.code === 'EPERM')) {
      const fallback = path.join(os.tmpdir(), 'pulse-video-uploads');
      fs.mkdirSync(fallback, { recursive: true });
      console.warn(
        `[env] VIDEO_UPLOAD_TMP_DIR "${candidate}" is not writable (${err.code}); using "${fallback}" (omit VIDEO_UPLOAD_TMP_DIR locally or use a path you own)`
      );
      return fallback;
    }
    throw new Error(
      `VIDEO_UPLOAD_TMP_DIR "${candidate}" is not usable: ${err?.message || err}`
    );
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('video-platform-backend'),
  API_PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  RABBITMQ_VIDEO_QUEUE: z.string().default('video.processing.queue'),
  RABBITMQ_VIDEO_EVENTS_QUEUE: z.string().default('video.lifecycle.events'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required'),
  VIDEO_UPLOAD_TMP_DIR: z.string().min(1).optional()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const data = parsed.data;

const videoUploadCandidate =
  data.VIDEO_UPLOAD_TMP_DIR?.trim() ||
  path.join(os.tmpdir(), 'pulse-video-uploads');

const env = {
  ...data,
  VIDEO_UPLOAD_TMP_DIR: resolveWritableVideoUploadDir(videoUploadCandidate)
};

export default env;
