import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entity/user';
import { PageFilter } from '@application/dto/page.filter';
import { GetUsersUseCase } from '@application/usecase/user/get-users.usecase';
import { AssignRoleUseCase } from '@application/usecase/user/assign-role.usecase';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private getUsersUseCase = inject(GetUsersUseCase);
  private assignRoleUseCase = inject(AssignRoleUseCase);

  getUsers(filter: PageFilter): Observable<User[]> {
    return this.getUsersUseCase.execute(filter);
  }

  assignRole(userId: string, roleId: string): Observable<User> {
    return this.assignRoleUseCase.execute(userId, roleId);
  }
}
