import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository } from '@application/ports/user.repository';
import { UserApi } from '@infrastructure/api/user.api';
import { BaseResponse } from '@application/dto/base/base-response';
import { User, UserListResult } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class UserRepositoryImpl implements UserRepository {
  private userApi = inject(UserApi);

  getUsers(page: number, size: number, search?: string): Observable<BaseResponse<UserListResult>> {
    return this.userApi.getUsers(page, size, search);
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    return this.userApi.assignRole(userId, roleId);
  }
}
