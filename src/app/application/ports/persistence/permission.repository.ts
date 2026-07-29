import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Permission } from '@domain/entities/permission';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

export interface PermissionRepository {
  getPermissions(filter: PageFilter): Observable<BaseListResponse<Permission>>;
  getPermissionById(id: string): Observable<Permission>;
  createPermission(payload: Partial<Permission>): Observable<Permission>;
  updatePermission(payload: Permission): Observable<Permission>;
  deletePermission(id: string): Observable<void>;
}

export const PERMISSION_REPOSITORY_TOKEN = new InjectionToken<PermissionRepository>('PermissionRepository');
