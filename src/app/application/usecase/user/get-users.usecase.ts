import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/user.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { UserListResult } from '@application/dto/user/user.dto';

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
