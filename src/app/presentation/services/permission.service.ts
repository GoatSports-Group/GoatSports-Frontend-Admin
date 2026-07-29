import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageFilter } from '@application/dto/page.filter';
import { GetPermissionsUseCase } from '@application/usecase/permission/get-permissions.usecase';
import { GetPermissionByIdUseCase } from '@application/usecase/permission/get-permission-by-id.usecase';
import { CreatePermissionUseCase } from '@application/usecase/permission/create-permission.usecase';
import { UpdatePermissionUseCase } from '@application/usecase/permission/update-permission.usecase';
import { DeletePermissionUseCase } from '@application/usecase/permission/delete-permission.usecase';
import { BaseListResponse } from '@application/dto/base/base-response';
import { Permission } from '@application/dto/permission/permission.dto';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private getPermissionsUseCase = inject(GetPermissionsUseCase);
  private getPermissionByIdUseCase = inject(GetPermissionByIdUseCase);
  private createPermissionUseCase = inject(CreatePermissionUseCase);
  private updatePermissionUseCase = inject(UpdatePermissionUseCase);
  private deletePermissionUseCase = inject(DeletePermissionUseCase);

  getPermissions(filter: PageFilter): Observable<BaseListResponse<Permission>> {
    return this.getPermissionsUseCase.execute(filter);
  }

  getPermissionById(id: string): Observable<Permission> {
    return this.getPermissionByIdUseCase.execute(id);
  }

  createPermission(payload: Partial<Permission>): Observable<Permission> {
    return this.createPermissionUseCase.execute(payload);
  }

  updatePermission(payload: Permission): Observable<Permission> {
    return this.updatePermissionUseCase.execute(payload);
  }

  deletePermission(id: string): Observable<void> {
    return this.deletePermissionUseCase.execute(id);
  }
}
