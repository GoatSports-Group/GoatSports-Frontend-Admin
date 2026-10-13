import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { PageFilter } from '@application/dto/page.filter';
import { GetUsersUseCase } from '@application/usecase/user/get-users.usecase';
import { AssignRoleUseCase } from '@application/usecase/user/assign-role.usecase';
import { CreateUserUseCase } from '@application/usecase/user/create-user.usecase';
import { GetUserByIdUseCase } from '@application/usecase/user/get-user-by-id.usecase';
import { UpdateUserPasswordByAdminUseCase } from '@application/usecase/user/update-user-password-by-admin.usecase';
import { ChangeUserStatusUseCase } from '@application/usecase/user/change-user-status.usecase';
import { VerifyUserUseCase } from '@application/usecase/user/verify-user.usecase';
import { CreateUserRequest } from '@application/dto/user/user.dto';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private createUserUseCase = inject(CreateUserUseCase)
  private getUsersUseCase = inject(GetUsersUseCase);
  private assignRoleUseCase = inject(AssignRoleUseCase);
  private getUserByIdUseCase = inject(GetUserByIdUseCase);
  private updateUserPasswordByAdminUseCase = inject(UpdateUserPasswordByAdminUseCase);
  private verifyUserUseCase = inject(VerifyUserUseCase);
  private changeUserStatusUseCase = inject(ChangeUserStatusUseCase);

  createUser(request: CreateUserRequest): Observable<User> {
    return this.createUserUseCase.execute(request);
  }

  getUsers(filter: PageFilter): Observable<BaseListResponse<User>> {
    return this.getUsersUseCase.execute(filter);
  }

  assignRole(userId: string, roleId: string): Observable<User> {
    return this.assignRoleUseCase.execute(userId, roleId);
  }



  getUserById(userId: string): Observable<User> {
    return this.getUserByIdUseCase.execute(userId);
  }



  updatePasswordByAdmin(userId: string, newPassword: string, confirmPassword: string): Observable<void> {
    return this.updateUserPasswordByAdminUseCase.execute(userId, { newPassword, confirmPassword });
  }

  verifyUser(userId: string, verified: boolean): Observable<void> {
    return this.verifyUserUseCase.execute(userId, verified);
  }

  changeStatus(userId: string, status: 'ACTIVE' | 'BLOCKED'): Observable<void> {
    return this.changeUserStatusUseCase.execute(userId, status);
  }
}
