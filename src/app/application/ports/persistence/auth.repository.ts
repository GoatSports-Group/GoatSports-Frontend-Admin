import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '@application/dto/user/user.dto';

export interface AuthRepository {
  logout(): Observable<void>;
  refresh(): Observable<User>;
  getCurrentUser(): Observable<User>;
  getPublicKey(): Observable<string>;
}

export const AUTH_REPOSITORY_TOKEN = new InjectionToken<AuthRepository>('AuthRepository');
