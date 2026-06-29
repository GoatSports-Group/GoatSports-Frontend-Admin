import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '@application/ports/persistence/auth.repository';
import { AuthApi } from '@infrastructure/api/auth.api';
import { BaseResponse } from '@application/dto/base/base-response';
import { User } from '@application/dto/user/user.dto';

@Injectable({
  providedIn: 'root'
})
export class AuthRepositoryImpl implements AuthRepository {
  private authApi = inject(AuthApi);

  logout(): Observable<BaseResponse<void>> {
    return this.authApi.logout();
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.authApi.refresh();
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.authApi.getCurrentUser();
  }
}
