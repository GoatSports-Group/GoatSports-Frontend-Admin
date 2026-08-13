import { Permission } from '@application/dto/permission/permission.dto';
import { Role } from '@application/dto/role/role.dto';

export interface RolePermissionsDialogData {
  role: Role;
}

export interface PermissionGroup {
  moduleName: string;
  permissions: Permission[];
  expanded: boolean;
}
