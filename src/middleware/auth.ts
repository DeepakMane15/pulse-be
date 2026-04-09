import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../lib/ApiError.js';
import { ROLE_CLEARANCE } from '../constants/roles.js';
import type { AuthUser } from '../types/auth.js';
import { RoleNameValues } from '../types/role.js';

export default function auth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new ApiError(401, 'Missing access token'));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    const role = String(payload.role || '');
    // Reject tokens carrying unknown role values.
    if (!RoleNameValues.includes(role as any)) {
      return next(new ApiError(401, 'Invalid role in token'));
    }

    (req as Request & { user: AuthUser }).user = {
      id: String(payload.sub),
      tenantId: payload.tenantId ? String(payload.tenantId) : undefined,
      role: role as AuthUser['role'],
      clearance: ROLE_CLEARANCE[role as AuthUser['role']] || 0
    };

    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}
