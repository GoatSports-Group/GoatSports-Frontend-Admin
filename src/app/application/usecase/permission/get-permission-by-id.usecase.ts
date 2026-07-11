import { PermissionRepository, PERMISSION_REPOSITORY_TOKEN } from '@application/ports/persistence/permission.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Permission } from '@domain/entities/permission';

@Injectable({
  providedIn: 'root'
})
export class GetPermissionByIdUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) { }

  execute(id: string): Observable<Permission> {
    return this.permissionRepository.getPermissionById(id);
  }
}
