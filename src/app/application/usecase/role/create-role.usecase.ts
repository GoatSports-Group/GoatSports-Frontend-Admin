import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Role, RoleCreateRequest } from '@application/dto/role/role.dto';

@Injectable({
  providedIn: 'root'
})
export class CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) { }

  execute(payload: RoleCreateRequest): Observable<BaseResponse<Role>> {
    return this.roleRepository.createRole(payload);
  }
}
