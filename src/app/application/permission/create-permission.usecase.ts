import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionRepository } from '../../domain/repositories/permission.repository';
import { PERMISSION_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';
import { Permission } from '../../domain/entities/permission';

@Injectable({
  providedIn: 'root'
})
export class CreatePermissionUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) {}

  execute(payload: Partial<Permission>): Observable<BaseResponse<Permission>> {
    return this.permissionRepository.createPermission(payload);
  }
}
