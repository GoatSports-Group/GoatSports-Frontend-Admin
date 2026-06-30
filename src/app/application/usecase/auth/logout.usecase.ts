import { AuthRepository, AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN) private authRepository: AuthRepository
  ) { }

  execute(): Observable<void> {
    return this.authRepository.logout();
  }
}
