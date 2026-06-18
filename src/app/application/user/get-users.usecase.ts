import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRepository } from '../../domain/repositories/user.repository';
import { USER_REPOSITORY_TOKEN } from '../../domain/repositories/tokens';
import { BaseResponse } from '../../domain/entities/base';
import { UserListResult } from '../../domain/entities/user';

@Injectable({
  providedIn: 'root'
})
export class GetUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
  ) {}

  execute(page: number, size: number, search?: string): Observable<BaseResponse<UserListResult>> {
    return this.userRepository.getUsers(page, size, search);
  }
}
