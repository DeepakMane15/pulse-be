import type { NextFunction, Request, Response } from 'express';
import ApiError from '../lib/ApiError.js';

export default function requireClearance(requiredMask: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userMask = (req as Request & { user?: { clearance?: number } }).user?.clearance || 0;
    const hasAccess = (userMask & requiredMask) === requiredMask;

    if (!hasAccess) {
      return next(new ApiError(403, 'Insufficient clearance'));
    }

    return next();
  };
}
