export { Role } from '@domain/entity/role';

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
