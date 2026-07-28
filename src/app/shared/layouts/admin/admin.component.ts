import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, of } from 'rxjs';
import { startWith, switchMap, catchError, map } from 'rxjs/operators';

import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { User } from '@application/dto/user/user.dto';
import { Notification, NotificationType } from '@application/dto/notification/notification.dto';

import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatSidenavModule,
    LucideIconComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  // Signals state management
  sidebarCollapsed = signal(false);
  isOnline = signal(true);
  searchQuery = signal('');
  isSearchOpen = signal(false);
  selectedSearchIndex = signal(0);

  searchItems = [
    {
      title: 'Tổng quan',
      description: 'Xem số liệu thống kê, dự báo thời tiết và phân tích hệ thống',
      icon: 'layout-dashboard',
      route: '/dashboard'
    },
    {
      title: 'Chủ Sân',
      description: 'Duyệt đơn đăng ký, quản lý hồ sơ và thông tin chủ sân thể thao',
      icon: 'land-plot',
      route: '/owner-applications',
    },
    {
      title: 'Người dùng',
      description: 'Quản lý tài khoản người dùng, phân vai trò thành viên hệ thống',
      icon: 'users',
      route: '/users',
    },
    {
      title: 'Vai trò',
      description: 'Quản lý các nhóm vai trò quyền hạn của quản trị viên',
      icon: 'shield',
      route: '/roles',
    },
    {
      title: 'Quyền hạn',
      description: 'Quản lý danh sách các quyền truy cập tài nguyên hệ thống',
      icon: 'key',
      route: '/permissions',
    }
  ];

  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.searchItems;
    return this.searchItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ctrl+K or Cmd+K to open
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    }

    // Escape to close
    if (event.key === 'Escape' && this.isSearchOpen()) {
      event.preventDefault();
      this.closeSearch();
    }

    if (this.isSearchOpen()) {
      const items = this.filteredItems();
      if (items.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedSearchIndex.update(idx => (idx + 1) % items.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedSearchIndex.update(idx => (idx - 1 + items.length) % items.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this.selectSearchItem(items[this.selectedSearchIndex()]);
      }
    }
  }

  openSearch() {
    this.isSearchOpen.set(true);
    this.searchQuery.set('');

    try {
      if (this.router && this.router.url) {
        const currentUrl = this.router.url.split('?')[0]; // strip query parameters
        const activeIndex = this.searchItems.findIndex(item =>
          currentUrl === '/admin' + item.route || currentUrl.startsWith('/admin' + item.route + '/')
        );
        this.selectedSearchIndex.set(activeIndex !== -1 ? activeIndex : 0);
      } else {
        this.selectedSearchIndex.set(0);
      }
    } catch (error) {
      console.error('Error getting active search index:', error);
      this.selectedSearchIndex.set(0);
    }

    setTimeout(() => {
      const input = document.getElementById('search-palette-input') as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  }

  closeSearch() {
    this.isSearchOpen.set(false);
  }

  selectSearchItem(item: any) {
    this.router.navigate(["/admin" + item.route]);
    this.closeSearch();
  }

  userProfile: User | null = null;
  clientUrl = import.meta.env.NG_APP_CLIENT_API_URL;
  private statusSub?: Subscription;

  notificationPage = 1;
  isNotificationLoading = false;

  ngOnInit() {
    this.userProfile = this.authService.currentUser;

    this.statusSub = interval(10000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get(`${this.apiBase}/auth-service/api/v1/auth/me`).pipe(
            map(() => true),
            catchError((err: any) => {
              const isReachable = err.status !== 0;
              return of(isReachable);
            })
          )
        )
      )
      .subscribe({
        next: (connected) => this.isOnline.set(connected),
        error: () => this.isOnline.set(false)
      });
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        const authUrl = import.meta.env.NG_APP_AUTH_API_URL;
        window.location.href = `${authUrl}/login`;
      }
    });
  }

  isNotifOpen = false;

  toggleNotifDropdown(event: Event): void {
    event.stopPropagation();
    this.isNotifOpen = !this.isNotifOpen;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isNotifOpen = false;
  }

  onNotificationClick(notification: Notification) {
    this.isNotifOpen = false;
    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => {
        if (notification.type === NotificationType.OWNER_APPLICATION) {
          this.router.navigate(['/owner-applications']);
        }
      }
    });
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe({
      error: (err) => console.error('Failed to mark all as read:', err)
    });
  }

  deleteNotification(notification: Notification) {
    this.notificationService.deleteNotification(notification.notificationId).subscribe({
      error: (err) => console.error('Failed to delete notification:', err)
    });
  }

  onNotificationScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (!element) return;

    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (atBottom) {
      this.notificationService.loadNextPage();
    }
  }

  get fallbackAvatar(): string {
    return this.userProfile?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.userProfile.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }

  getRelativeTime(dateInput: any): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Fallback if system clock difference is slightly negative
    if (diffMs < 0) return 'Vừa xong';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Vừa xong';
    } else if (diffMins < 60) {
      return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else if (diffDays === 1) {
      return 'Hôm qua';
    } else {
      return `${diffDays} ngày trước`;
    }
  }
}
