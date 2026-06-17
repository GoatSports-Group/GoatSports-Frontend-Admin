import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '../models/base.model';
import { Permission } from '../models/permission.model';

export interface PermissionListResult {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: Permission[];
}

@Injectable({
  providedIn: 'root'
})
export class PermissionAdminService {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getPermissions(page: number = 0, size: number = 200, search?: string): Observable<BaseResponse<PermissionListResult>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().replace(/'/g, "\\'");
      const filterVal = `name ~ '*${cleanSearch}*' or apiPath ~ '*${cleanSearch}*' or module ~ '*${cleanSearch}*' or method ~ '*${cleanSearch}*'`;
      params = params.set('filter', filterVal);
    }

    return this.http.get<BaseResponse<PermissionListResult>>(`${this.apiBase}/api/v1/permissions`, { params });
  }

  getPermissionById(id: string): Observable<BaseResponse<Permission>> {
    return this.http.get<BaseResponse<Permission>>(`${this.apiBase}/api/v1/permissions/${id}`);
  }

  createPermission(payload: Partial<Permission>): Observable<BaseResponse<Permission>> {
    return this.http.post<BaseResponse<Permission>>(`${this.apiBase}/api/v1/permissions`, payload);
  }

  updatePermission(payload: Permission): Observable<BaseResponse<Permission>> {
    return this.http.put<BaseResponse<Permission>>(`${this.apiBase}/api/v1/permissions`, payload);
  }

  deletePermission(id: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(`${this.apiBase}/api/v1/permissions/${id}`);
  }
}
