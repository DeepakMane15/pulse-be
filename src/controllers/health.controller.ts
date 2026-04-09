import type { Request, Response } from 'express';

export function getHealth(req: Request, res: Response): Response {
  return res.status(200).json({
    status: 'ok',
    service: 'video-platform-backend',
    timestamp: new Date().toISOString()
  });
}
