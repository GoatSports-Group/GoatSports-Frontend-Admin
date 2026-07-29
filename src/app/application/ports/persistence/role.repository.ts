import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Role, RoleCreateRequest, RoleUpdateRequest } from '@application/dto/role/role.dto';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

export interface RoleRepository {
  getRoles(filter: PageFilter): Observable<BaseListResponse<Role>>;
  getRoleById(id: string): Observable<Role>;
  createRole(payload: RoleCreateRequest): Observable<Role>;
  updateRole(payload: RoleUpdateRequest): Observable<Role>;
  deleteRole(id: string): Observable<void>;
  activateRole(id: string): Observable<Role>;
  deactivateRole(id: string): Observable<Role>;
}

export const ROLE_REPOSITORY_TOKEN = new InjectionToken<RoleRepository>('RoleRepository');
