import { PermissionRepository, PERMISSION_REPOSITORY_TOKEN } from '@application/ports/persistence/permission.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Permission } from '@application/dto/permission/permission.dto';

@Injectable({
  providedIn: 'root'
})
export class CreatePermissionUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) { }

  execute(payload: Partial<Permission>): Observable<BaseResponse<Permission>> {
    return this.permissionRepository.createPermission(payload);
  }
}
