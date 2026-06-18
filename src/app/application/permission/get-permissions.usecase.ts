import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionRepository } from '../../domain/repositories/permission.repository';
import { PERMISSION_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';
import { PermissionListResult } from '../../domain/entities/permission';

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
