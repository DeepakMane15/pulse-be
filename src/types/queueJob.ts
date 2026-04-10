import { z } from 'zod';

export type QueueJobStatus =
  | 'pending'
  | 'analyzing'
  | 'uploading'
  | 'completed'
  | 'failed';

/** API → worker: temp file on disk; worker uploads to final S3 key, runs Rekognition, creates Video. */
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
