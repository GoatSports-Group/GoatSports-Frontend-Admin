import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class AssignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
  ) { }

  execute(userId: string, roleId: string): Observable<User> {
    return this.userRepository.assignRole(userId, roleId);
  }
}
