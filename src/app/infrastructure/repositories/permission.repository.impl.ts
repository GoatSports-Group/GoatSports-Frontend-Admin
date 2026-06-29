import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionRepository } from '@application/ports/persistence/permission.repository';
import { PermissionApi } from '../api/permission.api';
import { BaseResponse } from '@application/dto/base/base-response';
import { Permission, PermissionListResult } from '@application/dto/permission/permission.dto';

@Injectable({
  providedIn: 'root'
})
export class PermissionRepositoryImpl implements PermissionRepository {
  private permissionApi = inject(PermissionApi);

  getPermissions(page: number, size: number, search?: string): Observable<BaseResponse<PermissionListResult>> {
    return this.permissionApi.getPermissions(page, size, search);
  }

  getPermissionById(id: string): Observable<BaseResponse<Permission>> {
    return this.permissionApi.getPermissionById(id);
  }

  createPermission(payload: Partial<Permission>): Observable<BaseResponse<Permission>> {
    return this.permissionApi.createPermission(payload);
  }

  updatePermission(payload: Permission): Observable<BaseResponse<Permission>> {
    return this.permissionApi.updatePermission(payload);
  }

  deletePermission(id: string): Observable<BaseResponse<void>> {
    return this.permissionApi.deletePermission(id);
  }
}
