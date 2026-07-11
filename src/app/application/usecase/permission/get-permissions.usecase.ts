import { PermissionRepository, PERMISSION_REPOSITORY_TOKEN } from '@application/ports/persistence/permission.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Permission } from '@domain/entities/permission';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class GetPermissionsUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY_TOKEN) private permissionRepository: PermissionRepository
  ) { }

  execute(filter: PageFilter): Observable<Permission[]> {
    return this.permissionRepository.getPermissions(filter);
  }
}
