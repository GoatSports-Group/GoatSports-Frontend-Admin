import { AuthRepository, AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN) private authRepository: AuthRepository
  ) { }

  execute(): Observable<BaseResponse<void>> {
    return this.authRepository.logout();
  }
}
