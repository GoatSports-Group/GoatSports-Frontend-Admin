import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { Role, RoleCreateRequest, RoleUpdateRequest, RoleListResult } from '@application/dto/role/role.dto';

@Injectable({
  providedIn: 'root'
})
export class RoleApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getRoles(page: number, size: number, search?: string): Observable<BaseResponse<RoleListResult>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().replace(/'/g, "\\'");
      const filterVal = `name ~ '*${cleanSearch}*' or description ~ '*${cleanSearch}*'`;
      params = params.set('filter', filterVal);
    }

    return this.http.get<BaseResponse<RoleListResult>>(`${this.apiBase}/auth-service/api/v1/admin/roles`, { params });
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
