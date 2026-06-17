import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '../models/base.model';
import { Role, RoleCreateRequest, RoleUpdateRequest } from '../models/role.model';

export interface RoleListResult {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: Role[];
}

@Injectable({
  providedIn: 'root'
})
export class RoleAdminService {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getRoles(page: number = 0, size: number = 100, search?: string): Observable<BaseResponse<RoleListResult>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().replace(/'/g, "\\'");
      const filterVal = `name ~ '*${cleanSearch}*' or description ~ '*${cleanSearch}*'`;
      params = params.set('filter', filterVal);
    }

    return this.http.get<BaseResponse<RoleListResult>>(`${this.apiBase}/api/v1/roles`, { params });
  }

  getRoleById(id: string): Observable<BaseResponse<Role>> {
    return this.http.get<BaseResponse<Role>>(`${this.apiBase}/api/v1/roles/${id}`);
  }

  createRole(payload: RoleCreateRequest): Observable<BaseResponse<Role>> {
    return this.http.post<BaseResponse<Role>>(`${this.apiBase}/api/v1/roles`, payload);
  }

  updateRole(payload: RoleUpdateRequest): Observable<BaseResponse<Role>> {
    return this.http.put<BaseResponse<Role>>(`${this.apiBase}/api/v1/roles`, payload);
  }

  deleteRole(id: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(`${this.apiBase}/api/v1/roles/${id}`);
  }

  activateRole(id: string): Observable<BaseResponse<Role>> {
    return this.http.put<BaseResponse<Role>>(`${this.apiBase}/api/v1/roles/${id}/activate`, {});
  }

  deactivateRole(id: string): Observable<BaseResponse<Role>> {
    return this.http.put<BaseResponse<Role>>(`${this.apiBase}/api/v1/roles/${id}/deactivate`, {});
  }
}
