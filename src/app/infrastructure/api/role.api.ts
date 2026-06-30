import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { Role, RoleCreateRequest, RoleUpdateRequest } from '@application/dto/role/role.dto';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@shared/utils/api.helper';

@Injectable({
  providedIn: 'root'
})
export class RoleApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getRoles(filter: PageFilter): Observable<BaseResponse<BaseListResponse<Role>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<Role>>>(`${this.apiBase}/auth-service/api/v1/admin/roles`, { params });
  }

  getRoleById(id: string): Observable<BaseResponse<Role>> {
    return this.http.get<BaseResponse<Role>>(`${this.apiBase}/auth-service/api/v1/admin/roles/${id}`);
  }

  createRole(payload: RoleCreateRequest): Observable<BaseResponse<Role>> {
    return this.http.post<BaseResponse<Role>>(`${this.apiBase}/auth-service/api/v1/admin/roles`, payload);
  }

  updateRole(payload: RoleUpdateRequest): Observable<BaseResponse<Role>> {
    return this.http.put<BaseResponse<Role>>(`${this.apiBase}/auth-service/api/v1/admin/roles`, payload);
  }

  deleteRole(id: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/admin/roles/${id}`);
  }

  activateRole(id: string): Observable<BaseResponse<Role>> {
    return this.http.put<BaseResponse<Role>>(`${this.apiBase}/auth-service/api/v1/admin/roles/${id}/activate`, {});
  }

  deactivateRole(id: string): Observable<BaseResponse<Role>> {
    return this.http.put<BaseResponse<Role>>(`${this.apiBase}/auth-service/api/v1/admin/roles/${id}/deactivate`, {});
  }
}
