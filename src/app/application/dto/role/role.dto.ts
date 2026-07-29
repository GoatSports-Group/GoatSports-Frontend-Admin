export { Role } from '@domain/entities/role';
export { ROLE_ENUM_OPTIONS as RoleEnum } from "@domain/enums/role.enum"

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
