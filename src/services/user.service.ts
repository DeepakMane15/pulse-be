import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import User from '../models/user.model.js';
import Role from '../models/role.model.js';
import Tenant from '../models/tenant.model.js';
import { hashPassword } from './auth.service.js';
import type { Actor, CreateUserInput, UpdateUserInput } from '../types/user.js';
import { RoleName } from '../types/role.js';

export async function findUserByEmail(email: string) {
  return User.findOne({ email: email.toLowerCase().trim() });
}

export async function findRoleById(roleId: string) {
  if (!mongoose.isValidObjectId(roleId)) return null;
  return Role.findById(roleId);
}

export async function findRoleByName(name: string) {
  return Role.findOne({ name: name.toLowerCase().trim() });
}

export async function createUserByActor(input: CreateUserInput, actor: Actor) {
  const email = input.email.toLowerCase().trim();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new ApiError(409, 'User with this email already exists');
  }

  // Tenant admins stay tenant-bound; super-admin can target any tenant.
  const isSuperAdmin = actor.role === RoleName.SuperAdmin;
  const targetTenantId = isSuperAdmin ? input.tenantId || actor.tenantId : actor.tenantId;

  if (!targetTenantId || !mongoose.isValidObjectId(targetTenantId)) {
    throw new ApiError(400, 'Valid tenantId is required');
  }

  const tenant = await Tenant.findById(targetTenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  // Role can be resolved either by id or by stable enum name.
  const role = input.roleId
    ? await findRoleById(input.roleId)
    : input.roleName
      ? await findRoleByName(input.roleName)
      : null;

  if (!role) {
    throw new ApiError(400, 'Valid roleId or roleName is required');
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await User.create({
    email,
    password: hashedPassword,
    tenantId: targetTenantId,
    roleId: role._id,
    isActive: input.isActive ?? true,
    createdBy: actor.id
  });

  return {
    id: user._id,
    email: user.email,
    tenantId: user.tenantId,
    roleId: user.roleId,
    isActive: user.isActive,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function sanitizeUser(user: any) {
  return {
    id: user._id,
    email: user.email,
    tenantId: user.tenantId,
    roleId: user.roleId,
    isActive: user.isActive,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type ListUsersFilters = {
  tenantId?: string;
  page?: number;
  limit?: number;
  search?: string;
  roleName?: string;
  isActive?: string;
};

export async function listUsersByActor(actor: Actor, filters: ListUsersFilters = {}) {
  const page = Math.max(1, Math.floor(Number(filters.page) || 1));
  const rawLimit = Number(filters.limit);
  const limit = [20, 50, 100].includes(rawLimit) ? rawLimit : 20;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  if (actor.role === RoleName.SuperAdmin) {
    const tid = filters.tenantId?.trim();
    if (tid && mongoose.isValidObjectId(tid)) {
      query.tenantId = tid;
    }
  } else {
    query.tenantId = actor.tenantId;
  }

  const search = filters.search?.trim();
  if (search) {
    query.email = { $regex: escapeRegex(search), $options: 'i' };
  }

  const activeRaw = filters.isActive?.trim().toLowerCase();
  if (activeRaw === 'true' || activeRaw === 'false') {
    query.isActive = activeRaw === 'true';
  }

  const roleFilter = filters.roleName?.trim().toLowerCase();
  if (roleFilter) {
    const role = await Role.findOne({ name: roleFilter });
    if (!role) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 }
      };
    }
    query.roleId = role._id;
  }

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .populate('roleId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const data = mapUserRows(users);

  return {
    data,
    meta: { total, page, limit, totalPages }
  };
}

function mapUserRows(users: any[]) {
  return users.map((u) => {
    const roleDoc = u.roleId as { _id?: unknown; name?: string } | null;
    return {
      id: u._id,
      email: u.email,
      tenantId: u.tenantId,
      roleId: roleDoc && typeof roleDoc === 'object' && '_id' in roleDoc ? roleDoc._id : u.roleId,
      roleName: roleDoc && typeof roleDoc === 'object' && roleDoc.name ? roleDoc.name : null,
      isActive: u.isActive,
      createdBy: u.createdBy,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  });
}

export async function getUserByIdForActor(userId: string, actor: Actor) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid userId');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent cross-tenant access for tenant admins.
  if (actor.role !== RoleName.SuperAdmin && String(user.tenantId) !== actor.tenantId) {
    throw new ApiError(403, 'Cannot access user outside your tenant');
  }

  return sanitizeUser(user);
}

export async function updateUserByActor(userId: string, input: UpdateUserInput, actor: Actor) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid userId');
  }

  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent cross-tenant updates for tenant admins.
  if (actor.role !== RoleName.SuperAdmin && String(existingUser.tenantId) !== actor.tenantId) {
    throw new ApiError(403, 'Cannot update user outside your tenant');
  }

  const updatePayload: Record<string, unknown> = {};

  if (input.email !== undefined) {
    const normalizedEmail = input.email.toLowerCase().trim();
    // Keep email unique across users.
    const duplicate = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: existingUser._id }
    });
    if (duplicate) {
      throw new ApiError(409, 'User with this email already exists');
    }
    updatePayload.email = normalizedEmail;
  }

  if (input.password !== undefined) {
    updatePayload.password = await hashPassword(input.password);
  }

  if (input.isActive !== undefined) {
    updatePayload.isActive = input.isActive;
  }

  if (input.roleId || input.roleName) {
    const role = input.roleId
      ? await findRoleById(input.roleId)
      : input.roleName
        ? await findRoleByName(input.roleName)
        : null;

    if (!role) {
      throw new ApiError(400, 'Valid roleId or roleName is required');
    }

    updatePayload.roleId = role._id;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new ApiError(400, 'At least one field is required to update user');
  }

  const updatedUser = await User.findByIdAndUpdate(existingUser._id, updatePayload, {
    new: true,
    runValidators: true
  });

  if (!updatedUser) {
    throw new ApiError(404, 'User not found');
  }

  return sanitizeUser(updatedUser);
}

export async function deleteUserByActor(userId: string, actor: Actor) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid userId');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent cross-tenant deletion for tenant admins.
  if (actor.role !== RoleName.SuperAdmin && String(user.tenantId) !== actor.tenantId) {
    throw new ApiError(403, 'Cannot delete user outside your tenant');
  }

  await User.findByIdAndDelete(userId);
  return { deleted: true };
}
