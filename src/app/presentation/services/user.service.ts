import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entity/user';
import { PageFilter } from '@application/dto/page.filter';
import { GetUsersUseCase } from '@application/usecase/user/get-users.usecase';
import { AssignRoleUseCase } from '@application/usecase/user/assign-role.usecase';
import { ExportUsersReportUseCase } from '@application/usecase/user/export-users-report.usecase';
import { ExportUserDetailReportUseCase } from '@application/usecase/user/export-user-detail-report.usecase';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private getUsersUseCase = inject(GetUsersUseCase);
  private assignRoleUseCase = inject(AssignRoleUseCase);
  private exportUsersReportUseCase = inject(ExportUsersReportUseCase);
  private exportUserDetailReportUseCase = inject(ExportUserDetailReportUseCase);

  getUsers(filter: PageFilter): Observable<User[]> {
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
