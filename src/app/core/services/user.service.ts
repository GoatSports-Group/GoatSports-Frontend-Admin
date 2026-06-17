import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '../models/base.model';
import { User } from '../models/user.model';

export interface UserListMeta {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

export interface UserListResult {
  meta: UserListMeta;
  result: User[];
}

@Injectable({
  providedIn: 'root'
})
export class UserAdminService {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getUsers(page: number = 0, size: number = 10, search?: string): Observable<BaseResponse<UserListResult>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().replace(/'/g, "\\'");
      const filterVal = `fullName ~ '*${cleanSearch}*' or username ~ '*${cleanSearch}*' or email ~ '*${cleanSearch}*'`;
      params = params.set('filter', filterVal);
    }

    return this.http.get<BaseResponse<UserListResult>>(`${this.apiBase}/api/v1/users`, { params });
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    const payload = { userId, roleId };
    return this.http.put<BaseResponse<User>>(`${this.apiBase}/api/v1/users/role`, payload);
  }
}
