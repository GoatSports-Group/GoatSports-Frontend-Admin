import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { PageFilter } from '@application/dto/page.filter';
import { GetUsersUseCase } from '@application/usecase/user/get-users.usecase';
import { AssignRoleUseCase } from '@application/usecase/user/assign-role.usecase';
import { ExportUsersReportUseCase } from '@application/usecase/user/export-users-report.usecase';
import { ExportUserDetailReportUseCase } from '@application/usecase/user/export-user-detail-report.usecase';
import { CreateUserUseCase } from '@application/usecase/user/create-user.usecase';
import { GetUserByIdUseCase } from '@application/usecase/user/get-user-by-id.usecase';
import { UpdateUserUseCase } from '@application/usecase/user/update-user.usecase';
import { UpdateUserAvatarUseCase } from '@application/usecase/user/update-user-avatar.usecase';
import { UpdateUserPasswordByAdminUseCase } from '@application/usecase/user/update-user-password-by-admin.usecase';
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
  private exportUsersReportUseCase = inject(ExportUsersReportUseCase);
  private exportUserDetailReportUseCase = inject(ExportUserDetailReportUseCase);
  private getUserByIdUseCase = inject(GetUserByIdUseCase);
  private updateUserUseCase = inject(UpdateUserUseCase);
  private updateUserAvatarUseCase = inject(UpdateUserAvatarUseCase);
  private updateUserPasswordByAdminUseCase = inject(UpdateUserPasswordByAdminUseCase);
  private verifyUserUseCase = inject(VerifyUserUseCase);

  createUser(request: CreateUserRequest): Observable<User> {
    return this.createUserUseCase.execute(request);
  }

  getUsers(filter: PageFilter): Observable<BaseListResponse<User>> {
    return this.getUsersUseCase.execute(filter);
  }

  assignRole(userId: string, roleId: string): Observable<User> {
    return this.assignRoleUseCase.execute(userId, roleId);
  }

  exportUsersReport(format: string): Observable<Blob> {
    return this.exportUsersReportUseCase.execute(format);
  }

  exportUserDetailReport(userId: string, format: string): Observable<Blob> {
    return this.exportUserDetailReportUseCase.execute(userId, format);
  }

  getUserById(userId: string): Observable<User> {
    return this.getUserByIdUseCase.execute(userId);
  }

  updateUser(userId: string, data: Partial<User>): Observable<User> {
    return this.updateUserUseCase.execute(userId, data);
  }

  updateAvatar(userId: string, tempKey: string): Observable<void> {
    return this.updateUserAvatarUseCase.execute(userId, tempKey);
  }

  updatePasswordByAdmin(userId: string, newPassword: string, confirmPassword: string): Observable<void> {
    return this.updateUserPasswordByAdminUseCase.execute(userId, { newPassword, confirmPassword });
  }

  verifyUser(userId: string, verified: boolean): Observable<void> {
    return this.verifyUserUseCase.execute(userId, verified);
  }
}
