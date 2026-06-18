import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository } from '../../domain/repositories/user.repository';
import { USER_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';
import { User } from '../../domain/entities/user';

@Injectable({
  providedIn: 'root'
})
export class AssignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
  ) {}

  execute(userId: string, roleId: string): Observable<BaseResponse<User>> {
    return this.userRepository.assignRole(userId, roleId);
  }
}
