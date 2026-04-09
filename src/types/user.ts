import type { RoleName } from './role.js';

export type CreateUserInput = {
  email: string;
  password: string;
  tenantId?: string;
  roleId?: string;
  roleName?: RoleName;
  isActive?: boolean;
};

export type UpdateUserInput = {
  email?: string;
  password?: string;
  roleId?: string;
  roleName?: RoleName;
  isActive?: boolean;
};

export type Actor = {
  id: string;
  tenantId?: string;
  role: RoleName;
  clearance: number;
};
