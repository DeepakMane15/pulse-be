import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import Tenant from '../models/tenant.model.js';
import QueueJobLog from '../models/queueJobLog.model.js';
import { publishVideoUploadJob } from '../queue/videoUpload.publisher.js';
import type { Actor } from '../types/user.js';
import type { UploadVideoInput } from '../types/video.js';

export async function queueVideoUploadByActor(
  input: UploadVideoInput,
  file: Express.Multer.File | undefined,
  actor: Actor
) {
  if (!file) {
    throw new ApiError(400, 'Video file is required');
  }

  if (!file.path) {
    throw new ApiError(500, 'Upload temp storage is not configured');
  }

  if (!file.mimetype.startsWith('video/')) {
    await fs.unlink(file.path).catch(() => {});
    throw new ApiError(400, 'Only video files are allowed');
  }

  if (!actor.tenantId || !mongoose.isValidObjectId(actor.tenantId)) {
    await fs.unlink(file.path).catch(() => {});
    throw new ApiError(400, 'Valid tenant context is required');
  }

  const tenant = await Tenant.findById(actor.tenantId);
  if (!tenant) {
    await fs.unlink(file.path).catch(() => {});
    throw new ApiError(404, 'Tenant not found');
  }

  const title = input.title?.trim() || null;
  const description = input.description?.trim() || null;

  try {
    const jobLog = await QueueJobLog.create({
      jobType: 'video_upload',
      status: 'pending',
      tenantId: actor.tenantId,
      uploadedBy: actor.id,
      title,
      description,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size
    });

    try {
      await publishVideoUploadJob({
        jobLogId: jobLog._id.toString(),
        tempFilePath: file.path,
        tenantId: actor.tenantId.toString(),
        uploadedBy: actor.id.toString(),
        title,
        description,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      });
    } catch (error: any) {
      await fs.unlink(file.path).catch(() => {});
      await QueueJobLog.findByIdAndUpdate(jobLog._id, {
        status: 'failed',
        errorMessage: error.message || 'Failed to enqueue upload job'
      });
      throw error;
    }

    return {
      jobId: jobLog._id,
      status: jobLog.status,
      fileName: jobLog.fileName,
      mimeType: jobLog.mimeType,
      sizeBytes: jobLog.sizeBytes,
      createdAt: jobLog.createdAt
    };
  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }
}
