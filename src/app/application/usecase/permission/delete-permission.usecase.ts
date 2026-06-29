import { PermissionRepository, PERMISSION_REPOSITORY_TOKEN } from '@application/ports/persistence/permission.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class DeletePermissionUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) { }

  execute(id: string): Observable<BaseResponse<void>> {
    return this.permissionRepository.deletePermission(id);
  }
}
