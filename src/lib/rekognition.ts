import {
  GetContentModerationCommand,
  RekognitionClient,
  StartContentModerationCommand,
  type ContentModerationDetection
} from '@aws-sdk/client-rekognition';
import env from '../config/env.js';
import logger from '../config/logger.js';

const rekognitionClient = new RekognitionClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollModerationUntilDone(jobId: string): Promise<ContentModerationDetection[]> {
  const deadline = Date.now() + env.REKOGNITION_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const res = await rekognitionClient.send(
      new GetContentModerationCommand({ JobId: jobId })
    );

    const status = res.JobStatus;
    if (status === 'IN_PROGRESS') {
      await sleep(env.REKOGNITION_POLL_INTERVAL_MS);
      continue;
    }

    if (status === 'FAILED') {
      throw new Error(res.StatusMessage || 'Rekognition content moderation failed');
    }

    if (status === 'SUCCEEDED') {
      const labels: ContentModerationDetection[] = [...(res.ModerationLabels ?? [])];
      let nextToken = res.NextToken;
      while (nextToken) {
        const page = await rekognitionClient.send(
          new GetContentModerationCommand({ JobId: jobId, NextToken: nextToken })
        );
        labels.push(...(page.ModerationLabels ?? []));
        nextToken = page.NextToken;
      }
      return labels;
    }

    throw new Error(`Unexpected Rekognition JobStatus: ${status}`);
  }

  throw new Error('Rekognition content moderation timed out');
}

/**
 * Runs async video content moderation on an object already in S3.
 * IAM needs rekognition:StartContentModeration, rekognition:GetContentModeration, s3:GetObject on the bucket.
 */
export async function classifyVideoModerationFromS3(objectKey: string): Promise<
  'safe' | 'flagged'
> {
  if (!env.REKOGNITION_ENABLED) {
    logger.warn('REKOGNITION_ENABLED=false; skipping moderation (treating as safe)');
    return 'safe';
  }

  const start = await rekognitionClient.send(
    new StartContentModerationCommand({
      Video: {
        S3Object: {
          Bucket: env.AWS_S3_BUCKET,
          Name: objectKey
        }
      },
      MinConfidence: env.REKOGNITION_MIN_CONFIDENCE
    })
  );

  const jobId = start.JobId;
  if (!jobId) {
    throw new Error('Rekognition did not return JobId');
  }

  const labels = await pollModerationUntilDone(jobId);

  if (labels.length > 0) {
    const first = labels[0]?.ModerationLabel;
    logger.info(
      'Content moderation flagged: %d detection(s), first=%s (%.1f%%)',
      labels.length,
      first?.Name,
      first?.Confidence ?? 0
    );
    return 'flagged';
  }

  return 'safe';
}
