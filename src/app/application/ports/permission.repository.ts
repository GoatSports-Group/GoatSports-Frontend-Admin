import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Permission, PermissionListResult } from '@application/dto/permission/permission.dto';

export interface PermissionRepository {
  getPermissions(page: number, size: number, search?: string): Observable<BaseResponse<PermissionListResult>>;
  getPermissionById(id: string): Observable<BaseResponse<Permission>>;
  createPermission(payload: Partial<Permission>): Observable<BaseResponse<Permission>>;
  updatePermission(payload: Permission): Observable<BaseResponse<Permission>>;
  deletePermission(id: string): Observable<BaseResponse<void>>;
}

export const PERMISSION_REPOSITORY_TOKEN = new InjectionToken<PermissionRepository>('PermissionRepository');
