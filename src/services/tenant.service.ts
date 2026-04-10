import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';
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

  // Only apply fields that are explicitly sent in request payload.
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
  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean();
  if (tenants.length === 0) return [];

  const ids = tenants.map((t) => t._id);
  const counts = await User.aggregate<{ _id: mongoose.Types.ObjectId; userCount: number }>([
    { $match: { tenantId: { $in: ids } } },
    { $group: { _id: '$tenantId', userCount: { $sum: 1 } } }
  ]);
  const countByTenant = new Map(counts.map((c) => [String(c._id), c.userCount]));

  return tenants.map((t) => ({
    ...t,
    userCount: countByTenant.get(String(t._id)) ?? 0
  }));
}
