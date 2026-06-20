import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Role, RoleUpdateRequest } from '@application/dto/role/role.dto';

@Injectable({
  providedIn: 'root'
})
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) {}

  execute(payload: RoleUpdateRequest): Observable<BaseResponse<Role>> {
    return this.roleRepository.updateRole(payload);
  }
}
