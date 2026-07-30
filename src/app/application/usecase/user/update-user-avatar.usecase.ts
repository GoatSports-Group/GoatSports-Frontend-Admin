import { UserRepository, USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UpdateUserAvatarUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) private userRepository: UserRepository
  ) { }

  execute(userId: string, tempKey: string): Observable<void> {
    return this.userRepository.updateAvatar(userId, tempKey);
  }
}
