import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Role } from '@domain/entities/role';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class GetRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) { }

  execute(filter: PageFilter): Observable<BaseListResponse<Role>> {
    return this.roleRepository.getRoles(filter);
  }
}
