import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { BaseResponse } from '../../domain/entities/base';
import { User } from '../../domain/entities/user';
import { SessionStateService } from '../../domain/models/session-state.service';
import { LogoutUseCase } from '../../application/auth/logout.usecase';
import { RefreshTokenUseCase } from '../../application/auth/refresh-token.usecase';
import { GetCurrentUserUseCase } from '../../application/auth/get-current-user.usecase';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private sessionStateService = inject(SessionStateService);
  private router = inject(Router);

  private logoutUseCase = inject(LogoutUseCase);
  private refreshTokenUseCase = inject(RefreshTokenUseCase);
  private getCurrentUserUseCase = inject(GetCurrentUserUseCase);

  private isLoggingOut = false;

  public currentUser$ = this.sessionStateService.currentUser$;
  public isAuthenticated$ = this.sessionStateService.isAuthenticated$;
  public sessionReady$ = this.sessionStateService.sessionReady$;

  constructor() {
    this.loadSession();
  }

  logout(): Observable<BaseResponse<void>> {
    return this.logoutUseCase.execute().pipe(
      tap({
        next: () => this.performLogout(),
        error: () => this.performLogout()
      })
    );
  }

  refresh(): Observable<BaseResponse<User>> {
    return this.refreshTokenUseCase.execute().pipe(
      tap({
        next: response => {
          const userProfile = response?.data;
          this.sessionStateService.setCurrentUser(userProfile);
        },
        error: () => {}
      })
    );
  }

  getCurrentUser(): Observable<BaseResponse<User>> {
    return this.getCurrentUserUseCase.execute().pipe(
      tap({
        next: response => {
          const userProfile = response?.data;
          this.sessionStateService.setCurrentUser(userProfile);
        },
        error: () => {
          this.clearSession();
        }
      })
    );
  }

  public get currentUser(): User | null {
    return this.sessionStateService.getCurrentUser();
  }

  public get isAuthenticated(): boolean {
    return this.sessionStateService.getIsAuthenticated();
  }

  public performLogout() {
    if (this.isLoggingOut) {
      console.log('Already logging out...');
      return;
    }

    this.isLoggingOut = true;
    console.log('Performing logout...');
    this.clearSession();

    const authUrl = import.meta.env.NG_APP_AUTH_API_URL;
    const adminUrl = import.meta.env.NG_APP_ADMIN_API_URL;
    window.location.href = `${authUrl}/login?redirect=${adminUrl}/admin`;
  }

  private loadSession() {
    this.refresh().subscribe({
      next: () => {
        this.sessionStateService.setSessionReady(true);
      },
      error: () => {
        this.clearSession();
        this.sessionStateService.setSessionReady(true);
      }
    });
  }

  private clearSession() {
    this.sessionStateService.clearSession();
  }
}
