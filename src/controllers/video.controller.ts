import type { Request, Response } from 'express';
import logger from '../config/logger.js';
import asyncHandler from '../lib/asyncHandler.js';
import {
  getUploadJobStatusForActor,
  listRecentVideosForActor,
  queueVideoUploadByActor
} from '../services/video.service.js';
import type { AuthenticatedRequest, MulterRequest } from '../types/auth.js';
import type { UploadVideoInput } from '../types/video.js';

export const listVideos = asyncHandler(async (req: Request, res: Response) => {
  const actor = (req as AuthenticatedRequest).user;
  const raw = req.query.limit;
  const limit =
    typeof raw === 'string'
      ? Number(raw)
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? Number(raw[0])
        : 10;
  const data = await listRecentVideosForActor(actor, Number.isFinite(limit) ? limit : 10);
  res.json({ message: 'OK', data });
});

export const getUploadJob = asyncHandler(async (req: Request, res: Response) => {
  const actor = (req as AuthenticatedRequest).user;
  const jobId = String(req.params.jobId ?? '');
  const data = await getUploadJobStatusForActor(jobId, actor);
  res.json({ message: 'OK', data });
});

export const uploadVideo = asyncHandler(async (req: Request, res: Response) => {
  logger.info('uploadVideo IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const input: UploadVideoInput = {
      title: req.body?.title,
      description: req.body?.description
    };

    const data = await queueVideoUploadByActor(input, (req as MulterRequest).file, actor);

    return res.status(202).json({
      message: 'Video upload started; processing continues in the background',
      data
    });
  } catch (error: any) {
    logger.error(`uploadVideo failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('uploadVideo OUT');
  }
});
