import mongoose from 'mongoose';
import ApiError from '../lib/ApiError.js';
import User from '../models/user.model.js';
import Role from '../models/role.model.js';
import Tenant from '../models/tenant.model.js';
import { hashPassword } from './auth.service.js';
import type { Actor, CreateUserInput } from '../types/user.js';
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

  const isSuperAdmin = actor.role === RoleName.SuperAdmin;
  const targetTenantId = isSuperAdmin ? input.tenantId || actor.tenantId : actor.tenantId;

  if (!targetTenantId || !mongoose.isValidObjectId(targetTenantId)) {
    throw new ApiError(400, 'Valid tenantId is required');
  }

  const tenant = await Tenant.findById(targetTenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

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
