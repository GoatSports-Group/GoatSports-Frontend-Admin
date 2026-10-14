import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { User } from '@domain/entities/user';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@infrastructure/api/build-page-params';
import { environment } from "@environments/environment"
import { CreateUserRequest } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class UserApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getUsers(filter: PageFilter): Observable<BaseResponse<BaseListResponse<User>>> {
    const params = buildPageParams(filter, true);
    return this.http.get<BaseResponse<BaseListResponse<User>>>(`${this.apiBase}/auth-service/api/v1/admin/users`, { params });
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    const payload = { userId, roleId };
    return this.http.put<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/admin/users/role`, payload);
  }

  createUser(payload: CreateUserRequest): Observable<BaseResponse<User>> {
    return this.http.post<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/admin/users`, payload);
  }

  getUserById(userId: string): Observable<BaseResponse<User>> {
    return this.http.get<BaseResponse<User>>(`${this.apiBase}/auth-service/api/v1/users/${userId}`);
  }



  getSummaries(userIds: string[]): Observable<BaseResponse<{ userId: string; fullName: string; email: string }[]>> {
    return this.http.post<BaseResponse<{ userId: string; fullName: string; email: string }[]>>(
      `${this.apiBase}/auth-service/api/v1/admin/users/summaries`, { userIds });
  }



  updatePasswordByAdmin(userId: string, payload: any): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/admin/users/${userId}/password`, payload);
  }

  changeStatus(userId: string, status: 'ACTIVE' | 'BLOCKED'): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/admin/users/${userId}/status`, { status });
  }

  verifyUser(userId: string, verified: boolean): Observable<BaseResponse<void>> {
    const params = new HttpParams().set('verified', verified);
    return this.http.put<BaseResponse<void>>(`${this.apiBase}/auth-service/api/v1/admin/users/${userId}/verify`, null, { params });
  }
}
