import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { User } from '@domain/entity/user';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@shared/utils/api.helper';

@Injectable({
  providedIn: 'root'
})
export class UserApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getUsers(filter: PageFilter): Observable<BaseResponse<BaseListResponse<User>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<User>>>(`${this.apiBase}/auth-service/api/v1/admin/users`, { params });
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    const payload = { userId, roleId };
    return this.http.put<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/admin/users/role`, payload);
  }
}
