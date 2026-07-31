import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { UserRepository } from '@application/ports/persistence/user.repository';
import { UserApi } from '@infrastructure/api/user.api';
import { User } from '@domain/entities/user';
import { PageFilter } from '@application/dto/page.filter';
import { CreateUserRequest } from '@application/dto/user/user.dto';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class UserRepositoryImpl implements UserRepository {
  private userApi = inject(UserApi);

  createUser(request: CreateUserRequest): Observable<User> {
    return this.userApi.createUser(request).pipe(
      map(response => response.data)
    );
  }

  getUsers(filter: PageFilter): Observable<BaseListResponse<User>> {
    return this.userApi.getUsers(filter).pipe(
      map(response => response.data)
    );
  }

  assignRole(userId: string, roleId: string): Observable<User> {
    return this.userApi.assignRole(userId, roleId).pipe(
      map(response => response.data)
    );
  }

  exportUsersReport(format: string): Observable<Blob> {
    return this.userApi.exportUsersReport(format);
  }

  exportUserDetailReport(userId: string, format: string): Observable<Blob> {
    return this.userApi.exportUserDetailReport(userId, format);
  }

  getUserById(userId: string): Observable<User> {
    return this.userApi.getUserById(userId).pipe(
      map(response => response.data)
    );
  }

  updateUser(userId: string, data: Partial<User>): Observable<User> {
    return this.userApi.updateUser(userId, data).pipe(
      map(response => response.data)
    );
  }

  updateAvatar(userId: string, tempKey: string): Observable<void> {
    return this.userApi.updateAvatar(userId, tempKey).pipe(
      map(response => response.data)
    );
  }

  updatePasswordByAdmin(userId: string, data: any): Observable<void> {
    return this.userApi.updatePasswordByAdmin(userId, data).pipe(
      map(response => response.data)
    );
  }
}
