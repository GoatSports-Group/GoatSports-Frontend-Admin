import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entities/user';
import { PageFilter } from '@application/dto/page.filter';
import { GetUsersUseCase } from '@application/usecase/user/get-users.usecase';
import { AssignRoleUseCase } from '@application/usecase/user/assign-role.usecase';
import { ExportUsersReportUseCase } from '@application/usecase/user/export-users-report.usecase';
import { ExportUserDetailReportUseCase } from '@application/usecase/user/export-user-detail-report.usecase';
import { CreateUserUseCase } from '@application/usecase/user/create-user.usecase';
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
}
