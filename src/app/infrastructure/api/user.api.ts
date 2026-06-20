import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User, UserListResult } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class UserApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getUsers(page: number, size: number, search?: string): Observable<BaseResponse<UserListResult>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().replace(/'/g, "\\'");
      const filterVal = `fullName ~ '*${cleanSearch}*' or username ~ '*${cleanSearch}*' or email ~ '*${cleanSearch}*'`;
      params = params.set('filter', filterVal);
    }

    return this.http.get<BaseResponse<UserListResult>>(`${this.apiBase}/auth-service/api/v1/admin/users`, { params });
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    const payload = { userId, roleId };
    return this.http.put<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/admin/users/role`, payload);
  }
}
