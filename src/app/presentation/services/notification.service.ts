import { Injectable, inject, NgZone } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  EMPTY,
  catchError,
  tap,
  map,
  finalize,
} from 'rxjs';
import { Notification, NotificationStatus } from '@application/dto/notification/notification.dto';
import { GetNotificationsUseCase } from '@application/usecase/notification/get-notifications.usecase';
import { CountUnreadNotificationsUseCase } from '@application/usecase/notification/count-unread-notifications.usecase';
import { MarkNotificationReadUseCase } from '@application/usecase/notification/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '@application/usecase/notification/mark-all-notifications-read.usecase';
import { DeleteNotificationUseCase } from '@application/usecase/notification/delete-notification.usecase';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { AuthService } from './auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  // ─── Use Cases ───────────────────────────────────────────────────────────────
  private getNotificationsUseCase = inject(GetNotificationsUseCase);
  private countUnreadUseCase      = inject(CountUnreadNotificationsUseCase);
  private markReadUseCase         = inject(MarkNotificationReadUseCase);
  private markAllReadUseCase      = inject(MarkAllNotificationsReadUseCase);
  private deleteNotificationUseCase = inject(DeleteNotificationUseCase);

  // ─── Infrastructure ───────────────────────────────────────────────────────────
  private wsService   = inject(WEBSOCKET_SERVICE_TOKEN);
  private authService = inject(AuthService);
  private snackBar    = inject(NotifyService);
  private ngZone      = inject(NgZone);

  // ─── State ────────────────────────────────────────────────────────────────────
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject   = new BehaviorSubject<number>(0);
  private isLoadingSubject      = new BehaviorSubject<boolean>(false);

  // Current pagination state
  private currentPage = 1;
  private readonly pageSize = 10;
  private hasMorePages = true;

  // ─── Public Streams ───────────────────────────────────────────────────────────
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();
  public unreadCount$: Observable<number>           = this.unreadCountSubject.asObservable();
  public isLoading$: Observable<boolean>            = this.isLoadingSubject.asObservable();

  // ─── Subscriptions ────────────────────────────────────────────────────────────
  private wsSubscription: Subscription | null   = null;
  private userSubscription: Subscription | null = null;

  constructor() {
    this.monitorUserSession();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════

  private monitorUserSession(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.resetPagination();
        this.loadInitialData();
        this.connectWebSocket();
      } else {
        this.disconnectWebSocket();
        this.clearState();
      }
    });
  }

  private loadInitialData(): void {
    this.fetchNotifications({ page: 1, size: this.pageSize }).subscribe();
    this.fetchUnreadCount().subscribe();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // WEBSOCKET
  // ══════════════════════════════════════════════════════════════════════════════

  private connectWebSocket(): void {
    this.wsService.connect();

    this.wsSubscription?.unsubscribe();

    this.wsSubscription = this.wsService.notifications$.subscribe({
      next: (notification) => {
        this.ngZone.run(() => this.handleRealTimeNotification(notification));
      },
      error: (err) => console.error('[NotificationService] WebSocket error:', err),
    });
  }

  private disconnectWebSocket(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    this.wsService.disconnect();
  }

  private handleRealTimeNotification(notification: Notification): void {
    const current = this.notificationsSubject.value;

    // Deduplicate: ignore if already in list
    if (current.some(n => n.notificationId === notification.notificationId)) return;

    this.notificationsSubject.next([notification, ...current]);
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);

    this.snackBar.open(`${notification.title}: ${notification.content}`, 'Đóng', {
      duration: 6000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-info'],
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // READ — Fetch & Pagination
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Fetch a page of notifications.
   * - Page 1 replaces the list; subsequent pages are appended (infinite scroll).
   * - Marks `hasMorePages = false` when the returned batch is smaller than pageSize.
   */
  public fetchNotifications(filter: PageFilter): Observable<Notification[]> {
    if (this.isLoadingSubject.value) return EMPTY;

    this.isLoadingSubject.next(true);

    return this.getNotificationsUseCase.execute(filter).pipe(
      tap((notifications) => {
        // Sort newest first
        notifications.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (filter.page === 1) {
          // First page: replace list
          this.notificationsSubject.next(notifications);
        } else {
          // Append pages, avoid duplicates
          const existing = this.notificationsSubject.value;
          const existingIds = new Set(existing.map(n => n.notificationId));
          const fresh = notifications.filter(n => !existingIds.has(n.notificationId));
          this.notificationsSubject.next([...existing, ...fresh]);
        }

        this.currentPage = filter.page ?? 1;
        this.hasMorePages = notifications.length >= (filter.size ?? this.pageSize);
      }),
      catchError((err) => {
        console.error('[NotificationService] fetchNotifications failed:', err);
        return EMPTY;
      }),
      finalize(() => this.isLoadingSubject.next(false)),
    );
  }

  /** Load the next page (called on scroll). No-op if already loading or no more pages. */
  public loadNextPage(): void {
    if (!this.hasMorePages || this.isLoadingSubject.value) return;
    this.fetchNotifications({ page: this.currentPage + 1, size: this.pageSize }).subscribe();
  }

  public fetchUnreadCount(): Observable<number> {
    return this.countUnreadUseCase.execute().pipe(
      tap((count) => this.unreadCountSubject.next(count)),
      catchError((err) => {
        console.error('[NotificationService] fetchUnreadCount failed:', err);
        return EMPTY;
      }),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // WRITE — Mark read / Mark all read / Delete
  // ══════════════════════════════════════════════════════════════════════════════

  /** Mark a single notification as read. Optimistically updates local state. */
  public markAsRead(id: string): Observable<Notification> {
    const notification = this.notificationsSubject.value.find(
      item => item.notificationId === id
    );

    if (!notification || notification.status !== NotificationStatus.UNREAD) {
      return EMPTY;
    }

    // Optimistic update before API call
    this.applyMarkAsRead(id);

    return this.markReadUseCase.execute(id).pipe(
      tap((updated) => {
        // Reconcile with server response (e.g. server-set readAt)
        const current = this.notificationsSubject.value.map(n =>
          n.notificationId === id ? { ...n, ...updated } : n
        );
        this.notificationsSubject.next(current);
      }),
      catchError((err) => {
        console.error('[NotificationService] markAsRead failed, reverting:', err);
        // Revert optimistic update on error
        this.revertMarkAsRead(id);
        return EMPTY;
      }),
    );
  }

  /** Mark all notifications as read. Optimistically updates local state. */
  public markAllRead(): Observable<void> {
    const snapshot = this.notificationsSubject.value;
    const snapshotCount = this.unreadCountSubject.value;

    // Optimistic update
    const allRead = snapshot.map(n => ({
      ...n,
      status: NotificationStatus.READ,
      readAt: n.readAt ?? new Date().toISOString(),
    }));
    this.notificationsSubject.next(allRead);
    this.unreadCountSubject.next(0);

    return this.markAllReadUseCase.execute().pipe(
      catchError((err) => {
        console.error('[NotificationService] markAllRead failed, reverting:', err);
        // Revert to snapshot
        this.notificationsSubject.next(snapshot);
        this.unreadCountSubject.next(snapshotCount);
        return EMPTY;
      }),
    );
  }

  /** Delete a single notification. Optimistically removes it from the list. */
  public deleteNotification(id: string): Observable<void> {
    const snapshot = this.notificationsSubject.value;
    const snapshotCount = this.unreadCountSubject.value;

    const target = snapshot.find(n => n.notificationId === id);
    if (!target) return EMPTY;

    // Optimistic removal
    this.notificationsSubject.next(snapshot.filter(n => n.notificationId !== id));
    if (target.status === NotificationStatus.UNREAD) {
      this.unreadCountSubject.next(Math.max(0, snapshotCount - 1));
    }

    return this.deleteNotificationUseCase.execute(id).pipe(
      catchError((err) => {
        console.error('[NotificationService] deleteNotification failed, reverting:', err);
        // Revert to snapshot
        this.notificationsSubject.next(snapshot);
        this.unreadCountSubject.next(snapshotCount);
        return EMPTY;
      }),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════════

  private applyMarkAsRead(id: string): void {
    const current = this.notificationsSubject.value;
    const target = current.find(n => n.notificationId === id);
    if (!target || target.status === NotificationStatus.READ) return;

    this.notificationsSubject.next(
      current.map(n =>
        n.notificationId === id
          ? { ...n, status: NotificationStatus.READ, readAt: new Date().toISOString() }
          : n
      )
    );
    this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
  }

  private revertMarkAsRead(id: string): void {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next(
      current.map(n =>
        n.notificationId === id
          ? { ...n, status: NotificationStatus.UNREAD, readAt: undefined }
          : n
      )
    );
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
  }

  private resetPagination(): void {
    this.currentPage = 1;
    this.hasMorePages = true;
  }

  private clearState(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.resetPagination();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════════

  public ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.disconnectWebSocket();
  }
}
