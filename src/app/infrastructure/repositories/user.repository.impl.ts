import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { UserRepository } from '@application/ports/persistence/user.repository';
import { UserApi } from '@infrastructure/api/user.api';
import { User } from '@domain/entity/user';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class UserRepositoryImpl implements UserRepository {
  private userApi = inject(UserApi);

  getUsers(filter: PageFilter): Observable<User[]> {
    return this.userApi.getUsers(filter).pipe(
      map(response => response.data?.result || [])
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
}
