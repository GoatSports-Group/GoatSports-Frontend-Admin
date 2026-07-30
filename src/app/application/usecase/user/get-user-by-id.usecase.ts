import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@domain/entities/user';

@Injectable({
  providedIn: 'root'
})
export class GetUserByIdUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
  ) { }

  execute(userId: string): Observable<User> {
    return this.userRepository.getUserById(userId);
  }
}
