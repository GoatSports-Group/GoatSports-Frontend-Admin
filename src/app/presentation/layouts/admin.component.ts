import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { User } from '@application/dto/user/user.dto';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, of } from 'rxjs';
import { startWith, switchMap, catchError, map } from 'rxjs/operators';
import { NotificationService } from '@presentation/services/notification.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  public notificationService = inject(NotificationService);
  private apiBase = import.meta.env.NG_APP_API_URL;

  userProfile: User | null = null;
  isOnline = true;
  clientUrl = import.meta.env.NG_APP_CLIENT_API_URL;
  private statusSub?: Subscription;

  ngOnInit() {
    this.userProfile = this.authService.currentUser;

    this.statusSub = interval(15000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get(`${this.apiBase}/auth-service/api/v1/auth/me`).pipe(
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
        const authUrl = import.meta.env.NG_APP_AUTH_API_URL;
        const adminUrl = import.meta.env.NG_APP_ADMIN_API_URL;
        window.location.href = `${authUrl}/login?redirect=${adminUrl}/admin`;
      }
    });
  }

  get fallbackAvatar(): string {
    return this.userProfile?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.userProfile.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }

  onNotificationClick(notification: any) {
    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => {
        if (notification.type === 'OWNER_APPLICATION') {
          this.router.navigate(['/owner-applications']);
        }
      }
    });
  }
}
