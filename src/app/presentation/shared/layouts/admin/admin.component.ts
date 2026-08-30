import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, interval, of } from 'rxjs';
import { startWith, switchMap, catchError, map } from 'rxjs/operators';

import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { GetCurrentUserUseCase } from '@application/usecase/auth/get-current-user.usecase';
import { User } from '@application/dto/user/user.dto';
import { Notification, NotificationStatus, NotificationType } from '@application/dto/notification/notification.dto';

import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { environment } from "@environments/environment"
import { formatRelativeTime } from '@shared/utils/date-trend.utils';
import { getFallbackAvatar } from '@shared/utils/user-display.utils';
import {
  AdminNavigationItem,
  PLATFORM_ADMIN_NAVIGATION,
  VENUE_OWNER_NAVIGATION
} from './admin-navigation.config';

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
  readonly getRelativeTime = formatRelativeTime;
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);
  private getCurrentUser = inject(GetCurrentUserUseCase);

  // Signals state management
  sidebarCollapsed = signal(false);
  isOnline = signal(true);
  searchQuery = signal('');
  isSearchOpen = signal(false);
  selectedSearchIndex = signal(0);
  userRole = signal('');
  isPlatformAdmin = computed(() => this.userRole() === 'ADMIN');

  readonly visibleNavigationItems = computed(() =>
    this.isPlatformAdmin() ? PLATFORM_ADMIN_NAVIGATION : VENUE_OWNER_NAVIGATION
  );

  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const roleItems = this.visibleNavigationItems();
    if (!q) return roleItems;
    return roleItems.filter(item =>
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
        const activeIndex = this.visibleNavigationItems().findIndex(item =>
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

  selectSearchItem(item: AdminNavigationItem) {
    this.router.navigate(["/admin" + item.route]);
    this.closeSearch();
  }

  userProfile: User | null = null;
  clientUrl = environment.clientApiUrl;
  private statusSub?: Subscription;

  notificationPage = 1;
  isNotificationLoading = false;

  ngOnInit() {
    this.userProfile = this.authService.currentUser;
    this.userRole.set(this.userProfile?.role?.name?.toUpperCase() ?? '');
    if (window.innerWidth < 1024) {
      this.sidebarCollapsed.set(true);
    }

    this.statusSub = interval(10000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.getCurrentUser.execute().pipe(
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
        const authUrl = environment.authApiUrl;
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

  onNotificationClick(notification: Notification): void {
    this.isNotifOpen = false;

    if (notification.status !== NotificationStatus.UNREAD) {
      this.navigateFromNotification(notification);
      return;
    }

    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => this.navigateFromNotification(notification)
    });
  }

  private navigateFromNotification(notification: Notification): void {
    if (notification.type === NotificationType.OWNER_APPLICATION) {
      const route = this.isPlatformAdmin() ? '/admin/owner-applications' : '/admin/dashboard';
      this.router.navigate([route]);
    }
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
    return this.userProfile
      ? getFallbackAvatar(this.userProfile)
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }
}
