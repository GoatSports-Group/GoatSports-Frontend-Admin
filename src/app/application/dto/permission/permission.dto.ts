export { Permission } from '@domain/entity/permission';

export interface PermissionListResult {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: import('@domain/entity/permission').Permission[];
}
