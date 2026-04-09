import type { Request, Response } from 'express';
import logger from '../config/logger.js';
import asyncHandler from '../lib/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import type { CreateTenantInput, UpdateTenantInput } from '../types/tenant.js';
import {
  createTenantByActor,
  deleteTenantById,
  listTenants,
  updateTenantById
} from '../services/tenant.service.js';

export const createTenant = asyncHandler(async (req: Request, res: Response) => {
  logger.info('createTenant IN');

  try {
    const actor = (req as AuthenticatedRequest).user;
    const input: CreateTenantInput = {
      name: req.body?.name,
      slug: req.body?.slug,
      status: req.body?.status
    };

    const data = await createTenantByActor(input, actor.id);

    return res.status(201).json({
      message: 'Tenant created',
      data
    });
  } catch (error: any) {
    logger.error(`createTenant failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('createTenant OUT');
  }
});

export const updateTenant = asyncHandler(async (req: Request, res: Response) => {
  logger.info('updateTenant IN');

  try {
    const input: UpdateTenantInput = {
      name: req.body?.name,
      slug: req.body?.slug,
      status: req.body?.status
    };

    const tenantId = String(req.params.tenantId);
    const data = await updateTenantById(tenantId, input);

    return res.status(200).json({
      message: 'Tenant updated',
      data
    });
  } catch (error: any) {
    logger.error(`updateTenant failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('updateTenant OUT');
  }
});

export const deleteTenant = asyncHandler(async (req: Request, res: Response) => {
  logger.info('deleteTenant IN');

  try {
    const tenantId = String(req.params.tenantId);
    await deleteTenantById(tenantId);

    return res.status(200).json({
      message: 'Tenant deleted'
    });
  } catch (error: any) {
    logger.error(`deleteTenant failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('deleteTenant OUT');
  }
});

export const getTenants = asyncHandler(async (_req: Request, res: Response) => {
  logger.info('getTenants IN');

  try {
    const data = await listTenants();

    return res.status(200).json({
      message: 'Tenants fetched',
      data
    });
  } catch (error: any) {
    logger.error(`getTenants failed: ${error.message}`);
    throw error;
  } finally {
    logger.info('getTenants OUT');
  }
});
