import { Observable } from 'rxjs';
import { BaseResponse } from '../entities/base';
import { Permission, PermissionListResult } from '../entities/permission';

export interface PermissionRepository {
  getPermissions(page: number, size: number, search?: string): Observable<BaseResponse<PermissionListResult>>;
  getPermissionById(id: string): Observable<BaseResponse<Permission>>;
  createPermission(payload: Partial<Permission>): Observable<BaseResponse<Permission>>;
  updatePermission(payload: Permission): Observable<BaseResponse<Permission>>;
  deletePermission(id: string): Observable<BaseResponse<void>>;
}
