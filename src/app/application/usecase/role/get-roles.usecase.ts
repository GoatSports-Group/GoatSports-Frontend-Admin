import { RoleRepository, ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { RoleListResult } from '@application/dto/role/role.dto';

@Injectable({
  providedIn: 'root'
})
export class GetRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_TOKEN) private roleRepository: RoleRepository
  ) { }

  execute(page: number, size: number, search?: string): Observable<BaseResponse<RoleListResult>> {
    return this.roleRepository.getRoles(page, size, search);
  }
}
