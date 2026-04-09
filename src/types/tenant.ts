export type TenantStatus = 'active' | 'suspended' | 'archived';

export type CreateTenantInput = {
  name: string;
  slug?: string;
  status?: TenantStatus;
};

export type UpdateTenantInput = {
  name?: string;
  slug?: string;
  status?: TenantStatus;
};
