import type { Request, Response } from 'express';
import logger from '../config/logger.js';
import asyncHandler from '../lib/asyncHandler.js';
import { createUserByActor } from '../services/user.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import type { CreateUserInput } from '../types/user.js';

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  logger.info('createUser IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const input: CreateUserInput = {
      email: req.body?.email,
      password: req.body?.password,
      tenantId: req.body?.tenantId,
      roleId: req.body?.roleId,
      roleName: req.body?.roleName,
      isActive: req.body?.isActive
    };

    const data = await createUserByActor(input, actor);

    return res.status(201).json({
      message: 'User created',
      data
    });
  } catch (error: any) {
    logger.error(`createUser failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('createUser OUT');
  }
});
