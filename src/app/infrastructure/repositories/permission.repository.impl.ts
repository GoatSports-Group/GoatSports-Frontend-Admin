import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { PermissionRepository } from '@application/ports/persistence/permission.repository';
import { PermissionApi } from '../api/permission.api';
import { PageFilter } from '@application/dto/page.filter';
import { Permission } from '@domain/entities/permission';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class PermissionRepositoryImpl implements PermissionRepository {
  private permissionApi = inject(PermissionApi);

  getPermissions(filter: PageFilter): Observable<BaseListResponse<Permission>> {
    return this.permissionApi.getPermissions(filter).pipe(
      map(response => response.data)
    );
  }

  getPermissionById(id: string): Observable<Permission> {
    return this.permissionApi.getPermissionById(id).pipe(
      map(response => response.data)
    );
  }

  createPermission(payload: Partial<Permission>): Observable<Permission> {
    return this.permissionApi.createPermission(payload).pipe(
      map(response => response.data)
    );
  }

  updatePermission(payload: Permission): Observable<Permission> {
    return this.permissionApi.updatePermission(payload).pipe(
      map(response => response.data)
    );
  }

  deletePermission(id: string): Observable<void> {
    return this.permissionApi.deletePermission(id).pipe(
      map(response => response.data)
    );
  }
}
