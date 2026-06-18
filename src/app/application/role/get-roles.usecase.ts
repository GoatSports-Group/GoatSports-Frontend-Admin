import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { ROLE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';
import { RoleListResult } from '../../domain/entities/role';

@Injectable({
  providedIn: 'root'
})
export class GetRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) {}

  execute(page: number, size: number, search?: string): Observable<BaseResponse<RoleListResult>> {
    return this.roleRepository.getRoles(page, size, search);
  }
}
