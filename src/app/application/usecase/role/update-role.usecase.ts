import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RoleUpdateRequest } from '@application/dto/role/role.dto';
import { Role } from '@domain/entities/role';

@Injectable({
  providedIn: 'root'
})
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) { }

  execute(payload: RoleUpdateRequest): Observable<Role> {
    return this.roleRepository.updateRole(payload);
  }
}
