import { z } from 'zod';

export type QueueJobStatus =
  | 'pending'
  | 'analyzing'
  | 'uploading'
  | 'completed'
  | 'failed';

/** API → analyze queue: temp file on disk for worker to stage + moderate. */
export type VideoAnalyzeQueuePayload = {
  jobLogId: string;
  tempFilePath: string;
  tenantId: string;
  uploadedBy: string;
  title: string | null;
  description: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export const videoAnalyzeQueuePayloadSchema = z.object({
  jobLogId: z.string().min(1),
  tempFilePath: z.string().min(1),
  tenantId: z.string().min(1),
  uploadedBy: z.string().min(1),
  title: z.string().nullable(),
  description: z.string().nullable(),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive()
});

/** Analyze → upload queue: Rekognition passed; object lives at staging key in S3. */
export type VideoS3UploadQueuePayload = {
  jobLogId: string;
  tenantId: string;
  uploadedBy: string;
  title: string | null;
  description: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  stagingS3Key: string;
};

export const videoS3UploadQueuePayloadSchema = z.object({
  jobLogId: z.string().min(1),
  tenantId: z.string().min(1),
  uploadedBy: z.string().min(1),
  title: z.string().nullable(),
  description: z.string().nullable(),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  stagingS3Key: z.string().min(1)
});
