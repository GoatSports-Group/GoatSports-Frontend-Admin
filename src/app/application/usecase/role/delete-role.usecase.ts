import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';

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
