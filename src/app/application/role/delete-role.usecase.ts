import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { ROLE_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';

@Injectable({
  providedIn: 'root'
})
export class DeleteRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) {}

  execute(id: string): Observable<BaseResponse<void>> {
    return this.roleRepository.deleteRole(id);
  }
}
