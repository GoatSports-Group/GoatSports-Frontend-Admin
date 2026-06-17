import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/index';
import { User } from '../../core/models/user.model';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, of } from 'rxjs';
import { startWith, switchMap, catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  userProfile: User | null = null;
  isOnline = true;
  clientUrl = import.meta.env.NG_APP_CLIENT_API_URL || 'http://localhost:4200';
  private statusSub?: Subscription;

  ngOnInit() {
    this.userProfile = this.authService.currentUser;

    // Periodically check connection status to backend
    this.statusSub = interval(15000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get(`${this.apiBase}/api/v1/auth/me`).pipe(
          map(() => true),
          catchError((err: any) => {
            // A status code other than 0 indicates the server is up and responding
            const isReachable = err.status !== 0;
            return of(isReachable);
          })
        ))
      ).subscribe({
        next: (connected) => {
          this.isOnline = connected;
        },
        error: () => {
          this.isOnline = false;
        }
      });
  }

  ngOnDestroy() {
    if (this.statusSub) {
      this.statusSub.unsubscribe();
    }
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        const authUrl = import.meta.env.NG_APP_AUTH_API_URL || 'http://localhost:4400';
        const adminUrl = import.meta.env.NG_APP_ADMIN_API_URL || 'http://localhost:4300';
        window.location.href = `${authUrl}/login?redirect=${adminUrl}/admin`;
      }
    });
  }

  get fallbackAvatar(): string {
    return this.userProfile?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.userProfile.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }
}
