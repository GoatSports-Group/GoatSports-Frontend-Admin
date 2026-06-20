import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Permission, PermissionListResult } from '@application/dto/permission/permission.dto';
import { GetPermissionsUseCase } from '@application/usecase/permission/get-permissions.usecase';
import { GetPermissionByIdUseCase } from '@application/usecase/permission/get-permission-by-id.usecase';
import { CreatePermissionUseCase } from '@application/usecase/permission/create-permission.usecase';
import { UpdatePermissionUseCase } from '@application/usecase/permission/update-permission.usecase';
import { DeletePermissionUseCase } from '@application/usecase/permission/delete-permission.usecase';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private getPermissionsUseCase = inject(GetPermissionsUseCase);
  private getPermissionByIdUseCase = inject(GetPermissionByIdUseCase);
  private createPermissionUseCase = inject(CreatePermissionUseCase);
  private updatePermissionUseCase = inject(UpdatePermissionUseCase);
  private deletePermissionUseCase = inject(DeletePermissionUseCase);

  getPermissions(page: number = 0, size: number = 200, search?: string): Observable<BaseResponse<PermissionListResult>> {
    return this.getPermissionsUseCase.execute(page, size, search);
  }

  getPermissionById(id: string): Observable<BaseResponse<Permission>> {
    return this.getPermissionByIdUseCase.execute(id);
  }

  createPermission(payload: Partial<Permission>): Observable<BaseResponse<Permission>> {
    return this.createPermissionUseCase.execute(payload);
  }

  updatePermission(payload: Permission): Observable<BaseResponse<Permission>> {
    return this.updatePermissionUseCase.execute(payload);
  }

  deletePermission(id: string): Observable<BaseResponse<void>> {
    return this.deletePermissionUseCase.execute(id);
  }
}
