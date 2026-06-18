import { Observable } from 'rxjs';
import { BaseResponse } from '../entities/base';
import { Role, RoleCreateRequest, RoleUpdateRequest, RoleListResult } from '../entities/role';

export interface RoleRepository {
  getRoles(page: number, size: number, search?: string): Observable<BaseResponse<RoleListResult>>;
  getRoleById(id: string): Observable<BaseResponse<Role>>;
  createRole(payload: RoleCreateRequest): Observable<BaseResponse<Role>>;
  updateRole(payload: RoleUpdateRequest): Observable<BaseResponse<Role>>;
  deleteRole(id: string): Observable<BaseResponse<void>>;
  activateRole(id: string): Observable<BaseResponse<Role>>;
  deactivateRole(id: string): Observable<BaseResponse<Role>>;
}
