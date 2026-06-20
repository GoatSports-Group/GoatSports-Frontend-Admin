export { Role } from '@domain/entity/role';

export interface RoleListResult {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: import('@domain/entity/role').Role[];
}

export interface RoleCreateRequest {
  name: string;
  description?: string;
}

export interface RoleUpdateRequest {
  roleId: string;
  name: string;
  description?: string;
  active: boolean;
  permissionIds: string[];
}
