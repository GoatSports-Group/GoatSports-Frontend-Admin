import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserRequest, User } from '@application/dto/user/user.dto';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

export interface UserRepository {
  createUser(request: CreateUserRequest): Observable<User>;
  getUsers(filter: PageFilter): Observable<BaseListResponse<User>>;
  assignRole(userId: string, roleId: string): Observable<User>;
  exportUsersReport(format: string): Observable<Blob>;
  exportUserDetailReport(userId: string, format: string): Observable<Blob>;
  getUserById(userId: string): Observable<User>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');