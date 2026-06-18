import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionRepository } from '../../domain/repositories/permission.repository';
import { PERMISSION_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';

@Injectable({
  providedIn: 'root'
})
export class DeletePermissionUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) {}

  execute(id: string): Observable<BaseResponse<void>> {
    return this.permissionRepository.deletePermission(id);
  }
}
