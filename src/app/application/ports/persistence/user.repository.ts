import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { PageFilter } from '@application/dto/page.filter';

export interface UserRepository {
  getUsers(filter: PageFilter): Observable<User[]>;
  assignRole(userId: string, roleId: string): Observable<User>;
  exportUsersReport(format: string): Observable<Blob>;
  exportUserDetailReport(userId: string, format: string): Observable<Blob>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');