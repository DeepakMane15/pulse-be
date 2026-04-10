import type { Request, Response } from 'express';
import logger from '../config/logger.js';
import asyncHandler from '../lib/asyncHandler.js';
import {
  createUserByActor,
  deleteUserByActor,
  getUserByIdForActor,
  listUsersByActor,
  updateUserByActor
} from '../services/user.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import type { CreateUserInput, UpdateUserInput } from '../types/user.js';

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

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  logger.info('getUsers IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const tenantId = parseQueryString(req.query.tenantId);
    const search = parseQueryString(req.query.search);
    const roleName = parseQueryString(req.query.roleName);
    const isActive = parseQueryString(req.query.isActive);
    const page = Number(parseQueryString(req.query.page)) || 1;
    const limit = Number(parseQueryString(req.query.limit)) || 20;

    const result = await listUsersByActor(actor, {
      tenantId,
      search,
      roleName,
      isActive,
      page,
      limit
    });

    return res.status(200).json({
      message: 'Users fetched',
      data: result.data,
      meta: result.meta
    });
  } catch (error: any) {
    logger.error(`getUsers failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('getUsers OUT');
  }
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  logger.info('getUserById IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const userId = String(req.params.userId);
    const data = await getUserByIdForActor(userId, actor);

    return res.status(200).json({
      message: 'User fetched',
      data
    });
  } catch (error: any) {
    logger.error(`getUserById failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('getUserById OUT');
  }
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  logger.info('updateUser IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const userId = String(req.params.userId);
    const input: UpdateUserInput = {
      email: req.body?.email,
      password: req.body?.password,
      roleId: req.body?.roleId,
      roleName: req.body?.roleName,
      isActive: req.body?.isActive
    };

    const data = await updateUserByActor(userId, input, actor);

    return res.status(200).json({
      message: 'User updated',
      data
    });
  } catch (error: any) {
    logger.error(`updateUser failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('updateUser OUT');
  }
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  logger.info('deleteUser IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const userId = String(req.params.userId);
    await deleteUserByActor(userId, actor);

    return res.status(200).json({
      message: 'User deleted'
    });
  } catch (error: any) {
    logger.error(`deleteUser failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('deleteUser OUT');
  }
});
