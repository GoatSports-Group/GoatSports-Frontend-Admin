import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entities/user';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class GetUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
  ) { }

  execute(filter: PageFilter): Observable<BaseListResponse<User>> {
    return this.userRepository.getUsers(filter);
  }
}
