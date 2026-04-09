import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import Tenant from '../models/tenant.model.js';
import type { CreateTenantInput, UpdateTenantInput } from '../types/tenant.js';

export async function createTenantByActor(input: CreateTenantInput, actorId: string) {
  if (!input.name || input.name.trim().length < 2) {
    throw new ApiError(400, 'Valid tenant name is required');
  }

  const payload = {
    name: input.name.trim(),
    slug: input.slug?.trim(),
    status: input.status,
    createdBy: actorId
  };

  try {
    const tenant = await Tenant.create(payload);
    return tenant;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'Tenant with this slug already exists');
    }
    throw error;
  }
}

export async function updateTenantById(tenantId: string, input: UpdateTenantInput) {
  if (!mongoose.isValidObjectId(tenantId)) {
    throw new ApiError(400, 'Invalid tenantId');
  }

  const updatePayload: UpdateTenantInput = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
    ...(input.status !== undefined ? { status: input.status } : {})
  };

  if (Object.keys(updatePayload).length === 0) {
    throw new ApiError(400, 'At least one field is required to update tenant');
  }

  try {
    const tenant = await Tenant.findByIdAndUpdate(tenantId, updatePayload, {
      new: true,
      runValidators: true
    });

    if (!tenant) {
      throw new ApiError(404, 'Tenant not found');
    }

    return tenant;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'Tenant with this slug already exists');
    }
    throw error;
  }
}

export async function deleteTenantById(tenantId: string) {
  if (!mongoose.isValidObjectId(tenantId)) {
    throw new ApiError(400, 'Invalid tenantId');
  }

  const tenant = await Tenant.findByIdAndDelete(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  return { deleted: true };
}

export async function listTenants() {
  return Tenant.find({}).sort({ createdAt: -1 });
}
