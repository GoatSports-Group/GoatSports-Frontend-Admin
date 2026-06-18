import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserApi } from '../api/user.api';
import { BaseResponse } from '../../domain/entities/base';
import { User, UserListResult } from '../../domain/entities/user';

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
