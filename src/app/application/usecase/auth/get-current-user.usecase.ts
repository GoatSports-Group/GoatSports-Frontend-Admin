import { AuthRepository, AUTH_REPOSITORY_TOKEN } from '@application/ports/auth.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { User } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class GetCurrentUserUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN) private authRepository: AuthRepository
  ) {}

  execute(): Observable<BaseResponse<User>> {
    return this.authRepository.getCurrentUser();
  }
}
