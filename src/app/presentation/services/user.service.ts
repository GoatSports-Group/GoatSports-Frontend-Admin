import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '../../domain/entities/base';
import { User, UserListResult } from '../../domain/entities/user';
import { GetUsersUseCase } from '../../application/user/get-users.usecase';
import { AssignRoleUseCase } from '../../application/user/assign-role.usecase';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private getUsersUseCase = inject(GetUsersUseCase);
  private assignRoleUseCase = inject(AssignRoleUseCase);

  getUsers(page: number = 0, size: number = 10, search?: string): Observable<BaseResponse<UserListResult>> {
    return this.getUsersUseCase.execute(page, size, search);
  }

  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>> {
    return this.assignRoleUseCase.execute(userId, roleId);
  }
}
