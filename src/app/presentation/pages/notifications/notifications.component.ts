import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Notification, NotificationStatus } from '@application/dto/notification/notification.dto';
import { GetNotificationPageUseCase } from '@application/usecase/notification/get-notification-page.usecase';
import { MarkNotificationReadUseCase } from '@application/usecase/notification/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '@application/usecase/notification/mark-all-notifications-read.usecase';
import { DeleteNotificationUseCase } from '@application/usecase/notification/delete-notification.usecase';
import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { notificationRoute, notificationView, relativeTime } from '@shared/utils/notification-view';

type Filter = 'ALL' | 'UNREAD';

/**
 * Trang Thong bao (mo tu "Xem tat ca thong bao" o chuong): tab Tat ca / Chua doc kem so, danh sach co phan trang,
 * bam de mo trang lien quan, xoa co xac nhan ngay tai dong. Giong trang Thong bao ben client.
 */
@Component({
  selector: 'app-admin-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideIconComponent, LoadingSkeletonComponent, PaginationComponent]
})
export class AdminNotificationsComponent implements OnInit {
  private readonly getPage = inject(GetNotificationPageUseCase);
  private readonly markRead = inject(MarkNotificationReadUseCase);
  private readonly markAllRead = inject(MarkAllNotificationsReadUseCase);
  private readonly deleteNotification = inject(DeleteNotificationUseCase);
  private readonly shell = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly listAnchor = viewChild<ElementRef<HTMLElement>>('listAnchor');

  readonly pageSize = PAGE_SIZE.rows;
  readonly filter = signal<Filter>('ALL');
  readonly pageIndex = signal(0);
  readonly items = signal<Notification[]>([]);
  readonly total = signal(0);
  readonly allCount = signal<number | null>(null);
  readonly unreadCount = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly failed = signal(false);
  readonly markingAll = signal(false);
  readonly confirmingId = signal<string | null>(null);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  readonly view = notificationView;
  readonly relativeTime = relativeTime;
  readonly UNREAD = NotificationStatus.UNREAD;
  private sequence = 0;

  ngOnInit(): void {
    this.shell.unreadCount$.subscribe(count => this.unreadCount.set(count));
    this.load();
  }

  setFilter(filter: Filter): void {
    if (filter === this.filter() && !this.failed()) return;
    this.filter.set(filter);
    this.pageIndex.set(0);
    this.confirmingId.set(null);
    this.load();
  }

  changePage(index: number): void {
    this.pageIndex.set(index);
    this.confirmingId.set(null);
    this.load(true);
  }

  load(paging = false): void {
    const sequence = ++this.sequence;
    if (paging) this.paging.set(true); else this.loading.set(true);
    this.failed.set(false);
    const filter = this.filter();
    this.getPage.execute({
      page: this.pageIndex() + 1,
      size: this.pageSize,
      filter: filter === 'UNREAD' ? "status : 'UNREAD'" : undefined
    }).pipe(finalize(() => {
      if (sequence !== this.sequence) return;
      this.loading.set(false);
      this.paging.set(false);
    })).subscribe({
      next: page => {
        if (sequence !== this.sequence) return;
        this.items.set(page.items);
        this.total.set(page.total);
        if (filter === 'ALL') this.allCount.set(page.total);
        if (paging) this.listAnchor()?.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
      error: () => {
        if (sequence === this.sequence) this.failed.set(true);
      }
    });
  }

  open(item: Notification): void {
    if (this.isPending(item.notificationId)) return;
    const route = notificationRoute(item, this.isPlatformAdmin());
    if (item.status !== NotificationStatus.UNREAD) {
      if (route) this.router.navigateByUrl(route);
      return;
    }
    this.withPending(item.notificationId, this.markRead.execute(item.notificationId), () => {
      this.items.update(list => this.filter() === 'UNREAD'
        ? list.filter(entry => entry.notificationId !== item.notificationId)
        : list.map(entry => entry.notificationId === item.notificationId ? { ...entry, status: NotificationStatus.READ } : entry));
      this.shell.refresh();
      if (route) this.router.navigateByUrl(route);
    });
  }

  canOpen(item: Notification): boolean {
    return item.status === NotificationStatus.UNREAD || notificationRoute(item, this.isPlatformAdmin()) !== null;
  }

  readAll(): void {
    if (this.markingAll()) return;
    this.markingAll.set(true);
    this.markAllRead.execute().pipe(finalize(() => this.markingAll.set(false))).subscribe({
      next: () => {
        this.notify.success('Đã đánh dấu tất cả thông báo là đã đọc.');
        this.shell.refresh();
        this.pageIndex.set(0);
        this.load();
      },
      error: () => this.notify.error('Không thể cập nhật thông báo. Vui lòng thử lại.')
    });
  }

  askDelete(item: Notification, event: Event): void {
    event.stopPropagation();
    this.confirmingId.set(item.notificationId);
  }

  cancelDelete(event: Event): void {
    event.stopPropagation();
    this.confirmingId.set(null);
  }

  confirmDelete(item: Notification, event: Event): void {
    event.stopPropagation();
    this.withPending(item.notificationId, this.deleteNotification.execute(item.notificationId), () => {
      this.confirmingId.set(null);
      this.notify.success('Đã xóa thông báo.');
      this.shell.refresh();
      // Trang dang xem het dong thi lui mot trang; con lai nap lai de keo dong ke tiep len.
      if (this.items().length === 1 && this.pageIndex() > 0) this.pageIndex.update(index => index - 1);
      this.load(true);
    }, 'Không thể xóa thông báo. Vui lòng thử lại.');
  }

  isPending(id: string): boolean {
    return this.pending().has(id);
  }

  private isPlatformAdmin(): boolean {
    return this.auth.currentUser?.role?.name?.toUpperCase() === 'ADMIN';
  }

  private withPending(id: string, request: import('rxjs').Observable<unknown>, done: () => void,
    errorMessage = 'Không thể cập nhật thông báo. Vui lòng thử lại.'): void {
    if (this.isPending(id)) return;
    this.pending.update(set => new Set(set).add(id));
    request.pipe(finalize(() => this.pending.update(set => {
      const next = new Set(set);
      next.delete(id);
      return next;
    }))).subscribe({ next: () => done(), error: () => this.notify.error(errorMessage) });
  }
}
