import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Role } from '@domain/entity/role';

@Injectable({
  providedIn: 'root'
})
export class ActivateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) { }

  execute(id: string): Observable<Role> {
    return this.roleRepository.activateRole(id);
  }
}
