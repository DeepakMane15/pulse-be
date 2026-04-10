import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Router } from 'express';
import { PERMISSIONS } from '../constants/roles.js';
import env from '../config/env.js';
import { getUploadJob, listVideos, uploadVideo } from '../controllers/video.controller.js';
import auth from '../middleware/auth.js';
import requireClearance from '../middleware/requireClearance.js';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(env.VIDEO_UPLOAD_TMP_DIR, { recursive: true });
      cb(null, env.VIDEO_UPLOAD_TMP_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${randomUUID()}${ext}`);
    }
  }),
  limits: {
    fileSize: 1024 * 1024 * 500
  }
});

router.use(auth);
router.get('/', requireClearance(PERMISSIONS.VIEW_VIDEO), listVideos);
router.get(
  '/upload-jobs/:jobId',
  requireClearance(PERMISSIONS.VIEW_VIDEO),
  getUploadJob
);
router.post(
  '/upload',
  requireClearance(PERMISSIONS.UPLOAD_VIDEO),
  upload.single('video'),
  uploadVideo
);

export default router;
