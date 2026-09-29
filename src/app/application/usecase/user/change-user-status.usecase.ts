import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { USER_REPOSITORY_TOKEN, UserRepository } from '@application/ports/persistence/user.repository';

@Injectable({ providedIn: 'root' })
export class ChangeUserStatusUseCase {
  constructor(@Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository) { }

  execute(userId: string, status: 'ACTIVE' | 'BLOCKED'): Observable<void> {
    return this.userRepository.changeStatus(userId, status);
  }
}
