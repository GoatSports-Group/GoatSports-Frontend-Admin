import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { ROLE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';
import { Role, RoleCreateRequest } from '../../domain/entities/role';

@Injectable({
  providedIn: 'root'
})
export class CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) {}

  execute(payload: RoleCreateRequest): Observable<BaseResponse<Role>> {
    return this.roleRepository.createRole(payload);
  }
}
