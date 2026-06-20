import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Role, RoleCreateRequest, RoleUpdateRequest, RoleListResult } from '@application/dto/role/role.dto';

export interface RoleRepository {
  getRoles(page: number, size: number, search?: string): Observable<BaseResponse<RoleListResult>>;
  getRoleById(id: string): Observable<BaseResponse<Role>>;
  createRole(payload: RoleCreateRequest): Observable<BaseResponse<Role>>;
  updateRole(payload: RoleUpdateRequest): Observable<BaseResponse<Role>>;
  deleteRole(id: string): Observable<BaseResponse<void>>;
  activateRole(id: string): Observable<BaseResponse<Role>>;
  deactivateRole(id: string): Observable<BaseResponse<Role>>;
}

export const ROLE_REPOSITORY_TOKEN = new InjectionToken<RoleRepository>('RoleRepository');
