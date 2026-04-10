import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import Tenant from '../models/tenant.model.js';
import QueueJobLog from '../models/queueJobLog.model.js';
import Video from '../models/video.model.js';
import { publishVideoAnalyzeJob } from '../queue/videoAnalyze.publisher.js';
import type { Actor } from '../types/user.js';
import type { UploadVideoInput } from '../types/video.js';

type ListVideosOptions = {
  page: number;
  limit: number;
  safety: 'all' | 'safe' | 'flagged';
  query: string;
};

/**
 * Ensures title is unique per tenant among completed videos and in-flight upload jobs.
 * If `base` is taken, returns `base 2`, `base 3`, …
 */
async function resolveUniqueVideoTitle(
  tenantId: mongoose.Types.ObjectId | string,
  desired: string
): Promise<string> {
  const base = desired.trim();
  if (!base) {
    throw new ApiError(400, 'Title is required');
  }

  const [videoRows, activeJobRows] = await Promise.all([
    Video.find({ tenantId }).select('title').lean(),
    QueueJobLog.find({
      tenantId,
      status: { $in: ['pending', 'analyzing', 'uploading'] }
    })
      .select('title')
      .lean()
  ]);

  const used = new Set<string>();
  for (const v of videoRows) {
    if (v.title != null && String(v.title).trim()) {
      used.add(String(v.title).trim());
    }
  }
  for (const l of activeJobRows) {
    if (l.title != null && String(l.title).trim()) {
      used.add(String(l.title).trim());
    }
  }

  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

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

  const requestedTitle = input.title?.trim() ?? '';
  if (!requestedTitle) {
    await fs.unlink(file.path).catch(() => {});
    throw new ApiError(400, 'Title is required');
  }

  const title = await resolveUniqueVideoTitle(actor.tenantId, requestedTitle);
  const titleAdjusted = title !== requestedTitle;
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
      await publishVideoAnalyzeJob({
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
        errorMessage: error.message || 'Failed to enqueue analyze job'
      });
      throw error;
    }

    return {
      jobId: jobLog._id,
      status: jobLog.status,
      title: jobLog.title,
      titleAdjusted,
      requestedTitle,
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

function normalizeQuery(s: string): string {
  return s.trim().toLowerCase();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function matchesSearch(v: any, rawQuery: string): boolean {
  const q = normalizeQuery(rawQuery);
  if (!q) return true;
  const createdAt = v.createdAt ? new Date(v.createdAt) : null;
  const dateTokens = createdAt
    ? [
        createdAt.toLocaleDateString().toLowerCase(),
        createdAt.toLocaleString().toLowerCase(),
        String(createdAt.getFullYear()),
        String(createdAt.getMonth() + 1).padStart(2, '0'),
        String(createdAt.getDate()).padStart(2, '0')
      ]
    : [];
  const sizeMb = (Number(v.sizeBytes ?? 0) / (1024 * 1024)).toFixed(2);
  const duration = formatDuration(v.durationSeconds).toLowerCase();
  const haystack = [
    String(v.title ?? ''),
    String(v.fileName ?? ''),
    `${sizeMb} mb`,
    `${String(v.sizeBytes ?? 0)} bytes`,
    duration,
    ...dateTokens
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export async function listRecentVideosForActor(actor: Actor, options: ListVideosOptions) {
  if (!actor.tenantId || !mongoose.isValidObjectId(actor.tenantId)) {
    throw new ApiError(400, 'Valid tenant context is required');
  }
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
  const baseFilter: Record<string, unknown> = { tenantId: actor.tenantId };
  if (options.safety === 'safe' || options.safety === 'flagged') {
    baseFilter.sensitivityStatus = options.safety;
  }

  const query = options.query.trim();
  if (!query) {
    const [items, total] = await Promise.all([
      Video.find(baseFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Video.countDocuments(baseFilter)
    ]);
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  const all = await Video.find(baseFilter).sort({ createdAt: -1 }).lean();
  const filtered = all.filter((v) => matchesSearch(v, query));
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function getUploadJobStatusForActor(jobId: string, actor: Actor) {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new ApiError(400, 'Invalid job id');
  }
  if (!actor.tenantId || !mongoose.isValidObjectId(actor.tenantId)) {
    throw new ApiError(400, 'Valid tenant context is required');
  }
  const log = await QueueJobLog.findById(jobId).lean();
  if (!log || String(log.tenantId) !== actor.tenantId) {
    throw new ApiError(404, 'Job not found');
  }
  return {
    jobId: log._id.toString(),
    status: log.status,
    fileName: log.fileName,
    title: log.title,
    errorMessage: log.errorMessage,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt
  };
}
