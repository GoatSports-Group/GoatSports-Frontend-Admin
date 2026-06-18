import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { RoleApi } from '../api/role.api';
import { BaseResponse } from '../../domain/entities/base';
import { Role, RoleCreateRequest, RoleUpdateRequest, RoleListResult } from '../../domain/entities/role';

@Injectable({
  providedIn: 'root'
})
export class RoleRepositoryImpl implements RoleRepository {
  private roleApi = inject(RoleApi);

  getRoles(page: number, size: number, search?: string): Observable<BaseResponse<RoleListResult>> {
    return this.roleApi.getRoles(page, size, search);
  }

  getRoleById(id: string): Observable<BaseResponse<Role>> {
    return this.roleApi.getRoleById(id);
  }

  createRole(payload: RoleCreateRequest): Observable<BaseResponse<Role>> {
    return this.roleApi.createRole(payload);
  }

  updateRole(payload: RoleUpdateRequest): Observable<BaseResponse<Role>> {
    return this.roleApi.updateRole(payload);
  }

  deleteRole(id: string): Observable<BaseResponse<void>> {
    return this.roleApi.deleteRole(id);
  }

  activateRole(id: string): Observable<BaseResponse<Role>> {
    return this.roleApi.activateRole(id);
  }

  deactivateRole(id: string): Observable<BaseResponse<Role>> {
    return this.roleApi.deactivateRole(id);
  }
}
