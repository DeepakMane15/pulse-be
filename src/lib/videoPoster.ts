import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import logger from '../config/logger.js';
import { buildS3ObjectUrl, downloadS3ObjectToFile, uploadBufferToS3 } from './s3.js';

/**
 * Downloads the video from S3, runs ffmpeg to grab a frame (~0.5s), uploads JPEG next to the video.
 * No separate user upload — derived from the file itself. Requires `ffmpeg` on PATH (see Dockerfile).
 */
export async function generateAndStoreVideoPoster(
  videoObjectKey: string,
  posterObjectKey: string
): Promise<string | null> {
  const videoTmp = path.join(tmpdir(), `pulse-vid-${randomUUID()}`);
  const jpgTmp = path.join(tmpdir(), `pulse-poster-${randomUUID()}.jpg`);

  try {
    await downloadS3ObjectToFile(videoObjectKey, videoTmp);

    await new Promise<void>((resolve, reject) => {
      const ff = spawn(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-ss',
          '0.5',
          '-i',
          videoTmp,
          '-frames:v',
          '1',
          '-q:v',
          '3',
          jpgTmp
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
      let errBuf = '';
      ff.stderr?.on('data', (c: Buffer) => {
        errBuf += c.toString();
      });
      ff.on('error', (err) => reject(err));
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errBuf.trim() || `ffmpeg exited ${code}`));
      });
    });

    const buf = await readFile(jpgTmp);
    await uploadBufferToS3({
      key: posterObjectKey,
      body: buf,
      contentType: 'image/jpeg'
    });

    return buildS3ObjectUrl(posterObjectKey);
  } catch (err: any) {
    logger.warn('Video poster generation skipped: %s', err?.message || err);
    return null;
  } finally {
    await rm(videoTmp, { force: true }).catch(() => {});
    await rm(jpgTmp, { force: true }).catch(() => {});
  }
}
