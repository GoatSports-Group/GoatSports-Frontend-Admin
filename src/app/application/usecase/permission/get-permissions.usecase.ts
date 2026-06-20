import { PermissionRepository, PERMISSION_REPOSITORY_TOKEN } from '@application/ports/permission.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { PermissionListResult } from '@application/dto/permission/permission.dto';

@Injectable({
  providedIn: 'root'
})
export class GetPermissionsUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) {}

  execute(page: number, size: number, search?: string): Observable<BaseResponse<PermissionListResult>> {
    return this.permissionRepository.getPermissions(page, size, search);
  }
}
