import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { Permission } from '@domain/entities/permission';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@shared/utils/api.helper';
import { environment } from "@environments/environment"

@Injectable({
  providedIn: 'root'
})
export class PermissionApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getPermissions(filter: PageFilter): Observable<BaseResponse<BaseListResponse<Permission>>> {
    const params = buildPageParams(filter)
    return this.http.get<BaseResponse<BaseListResponse<Permission>>>(`${this.apiBase}/auth-service/api/v1/admin/permissions`, { params });
  }

  getPermissionById(id: string): Observable<BaseResponse<Permission>> {
    return this.http.get<BaseResponse<Permission>>(`${this.apiBase}/auth-service/api/v1/admin/permissions/${id}`);
  }

  createPermission(payload: Partial<Permission>): Observable<BaseResponse<Permission>> {
    return this.http.post<BaseResponse<Permission>>(`${this.apiBase}/auth-service/api/v1/admin/permissions`, payload);
  }

  updatePermission(payload: Permission): Observable<BaseResponse<Permission>> {
    return this.http.put<BaseResponse<Permission>>(`${this.apiBase}/auth-service/api/v1/admin/permissions`, payload);
  }

  deletePermission(id: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/admin/permissions/${id}`);
  }
}
