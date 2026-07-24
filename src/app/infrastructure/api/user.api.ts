import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { User } from '@domain/entities/user';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@shared/utils/api.helper';
import { environment } from "@environments/environment"

@Injectable({
  providedIn: 'root'
})
export class UserApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getUsers(filter: PageFilter): Observable<BaseResponse<BaseListResponse<User>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<User>>>(`${this.apiBase}/auth-service/api/v1/admin/users`, { params });
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    const payload = { userId, roleId };
    return this.http.put<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/admin/users/role`, payload);
  }

  exportUsersReport(format: string): Observable<Blob> {
    return this.http.get(`${this.apiBase}/report-service/api/v1/reports/export/users`, {
      params: new HttpParams().set('format', format),
      responseType: 'blob'
    });
  }

  exportUserDetailReport(userId: string, format: string): Observable<Blob> {
    return this.http.get(`${this.apiBase}/report-service/api/v1/reports/export/users/${userId}`, {
      params: new HttpParams().set('format', format),
      responseType: 'blob'
    });
  }
}
