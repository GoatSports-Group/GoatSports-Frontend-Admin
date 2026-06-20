import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User, UserListResult } from '@application/dto/user/user.dto';

export interface UserRepository {
  getUsers(page: number, size: number, search?: string): Observable<BaseResponse<UserListResult>>;
  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');
