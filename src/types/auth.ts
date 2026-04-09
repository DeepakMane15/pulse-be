import type { Request } from 'express';
import type { RoleName } from './role.js';

export type AuthUser = {
  id: string;
  tenantId?: string;
  role: RoleName;
  clearance: number;
};

export type AuthenticatedRequest = Request & { user: AuthUser };

export type MulterRequest = Request & {
  file?: Express.Multer.File;
};
