import type { Request, Response } from 'express';
import logger from '../config/logger.js';
import asyncHandler from '../lib/asyncHandler.js';
import { queueVideoUploadByActor } from '../services/video.service.js';
import type { AuthenticatedRequest, MulterRequest } from '../types/auth.js';
import type { UploadVideoInput } from '../types/video.js';

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
