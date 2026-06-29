import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Role } from '@application/dto/role/role.dto';

@Injectable({
  providedIn: 'root'
})
export class ActivateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) { }

  execute(id: string): Observable<BaseResponse<Role>> {
    return this.roleRepository.activateRole(id);
  }
}
