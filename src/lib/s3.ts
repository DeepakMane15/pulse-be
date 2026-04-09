import type { Readable } from 'node:stream';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import env from '../config/env.js';

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  }
});

/** Virtual-hosted–style HTTPS URL for the object (used after PutObject). */
export function buildS3ObjectUrl(objectKey: string): string {
  const bucket = env.AWS_S3_BUCKET;
  const region = env.AWS_REGION;
  const path = objectKey.split('/').map(encodeURIComponent).join('/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
}

export async function uploadBufferToS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ServerSideEncryption: 'AES256'
    })
  );
}

export async function uploadStreamToS3(params: {
  key: string;
  body: Readable;
  contentType: string;
}): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ServerSideEncryption: 'AES256'
    })
  );
}
