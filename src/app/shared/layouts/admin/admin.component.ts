import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@presentation/services/auth.service';
import { User } from '@application/dto/user/user.dto';
import { Notification, NotificationType } from '@application/dto/notification/notification.dto';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, of } from 'rxjs';
import { startWith, switchMap, catchError, map } from 'rxjs/operators';
import { NotificationService } from '@presentation/services/notification.service';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.scss'],
    standalone: false
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

  notificationPage = 1;
  isNotificationLoading = false;

  ngOnInit() {
    this.userProfile = this.authService.currentUser;

    this.statusSub = interval(10000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get(`${this.apiBase}/auth-service/api/v1/auth/me`).pipe(
          map(() => true),
          catchError((err: any) => {
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
        window.location.href = `${authUrl}/login`;
      }
    });
  }

  onNotificationClick(notification: Notification) {
    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => {
        if (notification.type === NotificationType.OWNER_APPLICATION) {
          this.router.navigate(['/owner-applications']);
        }
      }
    });
  }

  onNotificationScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (!element || this.isNotificationLoading) return;

    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
    const atTop = element.scrollTop === 0;

    if (atBottom) {
      this.loadNotificationPage(this.notificationPage + 1, element);
    } else if (atTop && this.notificationPage > 1) {
      this.loadNotificationPage(this.notificationPage - 1, element);
    }
  }

  private loadNotificationPage(page: number, scrollElement: HTMLElement): void {
    this.isNotificationLoading = true;
    this.notificationService.fetchNotifications({ page, size: 10 }).subscribe({
      next: (notifications) => {
        if (notifications.length > 0 || page === 1) {
          this.notificationPage = page;
          if (page > 1) {
            setTimeout(() => {
              scrollElement.scrollTop = 10;
            }, 50);
          } else {
            setTimeout(() => {
              scrollElement.scrollTop = scrollElement.scrollHeight - scrollElement.clientHeight - 10;
            }, 50);
          }
        } else {
          setTimeout(() => {
            scrollElement.scrollTop = scrollElement.scrollHeight - scrollElement.clientHeight - 10;
          }, 50);
        }
        this.isNotificationLoading = false;
      },
      error: () => {
        this.isNotificationLoading = false;
      }
    });
  }

  get fallbackAvatar(): string {
    return this.userProfile?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.userProfile.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }
}
