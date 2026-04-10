import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';
import type { CreateTenantInput, UpdateTenantInput } from '../types/tenant.js';

export async function createTenantByActor(input: CreateTenantInput, actorId: string) {
  if (!input.name || input.name.trim().length < 2) {
    throw new ApiError(400, 'Valid tenant name is required');
  }

  const slugTrim = input.slug?.trim();
  const payload: {
    name: string;
    status?: CreateTenantInput['status'];
    createdBy: string;
    slug?: string;
  } = {
    name: input.name.trim(),
    status: input.status,
    createdBy: actorId
  };
  // Only set slug when provided; otherwise the model's pre-validate hook derives it from `name`.
  if (slugTrim) {
    payload.slug = slugTrim;
  }

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
  const slugTrim =
    input.slug !== undefined && typeof input.slug === 'string' ? input.slug.trim() : null;
  const updatePayload: UpdateTenantInput = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(slugTrim ? { slug: slugTrim } : {}),
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

export type ListTenantsFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listTenants(filters: ListTenantsFilters = {}) {
  const page = Math.max(1, Math.floor(Number(filters.page) || 1));
  const rawLimit = Number(filters.limit);
  const limit = [20, 50, 100].includes(rawLimit) ? rawLimit : 20;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  const st = filters.status?.trim().toLowerCase();
  if (st === 'active' || st === 'suspended' || st === 'archived') {
    query.status = st;
  }
  const search = filters.search?.trim();
  if (search) {
    query.name = { $regex: escapeRegex(search), $options: 'i' };
  }

  const [total, tenants] = await Promise.all([
    Tenant.countDocuments(query),
    Tenant.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  if (tenants.length === 0) {
    return {
      data: [],
      meta: { total, page, limit, totalPages }
    };
  }

  const ids = tenants.map((t) => t._id);
  const counts = await User.aggregate<{ _id: mongoose.Types.ObjectId; userCount: number }>([
    { $match: { tenantId: { $in: ids } } },
    { $group: { _id: '$tenantId', userCount: { $sum: 1 } } }
  ]);
  const countByTenant = new Map(counts.map((c) => [String(c._id), c.userCount]));

  const data = tenants.map((t) => ({
    ...t,
    userCount: countByTenant.get(String(t._id)) ?? 0
  }));

  return {
    data,
    meta: { total, page, limit, totalPages }
  };
}
