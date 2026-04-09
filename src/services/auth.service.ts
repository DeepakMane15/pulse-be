import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../lib/ApiError.js';
import { findRoleById, findUserByEmail } from './user.service.js';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '1d' });
}

export async function loginUser(input: { email?: string; password?: string }) {
  const email = input.email?.toLowerCase().trim();
  const password = input.password;

  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'User account is inactive');
  }

  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const role = await findRoleById(String(user.roleId));
  if (!role) {
    throw new ApiError(500, 'User role is not configured');
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    tenantId: user.tenantId.toString(),
    role: role.name
  });

  return {
    accessToken,
    user: {
      id: user._id,
      email: user.email,
      tenantId: user.tenantId,
      role: role.name,
      roleId: role._id,
      clearanceLevel: role.clearanceLevel,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  };
}
