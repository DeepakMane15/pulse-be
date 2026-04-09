import type { NextFunction, Request, Response } from 'express';
import logger from '../config/logger.js';

export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err?.statusCode || 500;

  logger.error('%s %s -> %s', req.method, req.originalUrl, err?.message || 'Unknown error');

  res.status(statusCode).json({
    message: err?.message || 'Internal server error',
    details: err?.details || null
  });
}
