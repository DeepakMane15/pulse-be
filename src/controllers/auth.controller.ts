import type { Request, Response } from 'express';
import logger from '../config/logger.js';
import asyncHandler from '../lib/asyncHandler.js';
import { loginUser } from '../services/auth.service.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
  logger.info('login IN');

  try {
    const data = await loginUser({
      email: req.body?.email,
      password: req.body?.password
    });

    return res.status(200).json({
      message: 'Login successful',
      data
    });
  } catch (error: any) {
    logger.error(`login failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('login OUT');
  }
});
