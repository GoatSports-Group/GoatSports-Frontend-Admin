import { PAGE_SIZE } from '@shared/constants/page-size';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ADMIN_VENUE_REPOSITORY_TOKEN, AdminVenueStatus } from '@application/ports/persistence/admin-venue.repository';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';

const STATUS_TABS: readonly { value: AdminVenueStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang mở' },
  { value: 'INACTIVE', label: 'Chủ sân tạm tắt' },
  { value: 'SUSPENDED', label: 'Bị đình chỉ' }
];

/**
 * Mọi cơ sở trên nền tảng. Admin đình chỉ cơ sở vi phạm (ẩn khỏi tìm kiếm, chặn đơn mới, chủ sân không tự mở lại)
 * và gỡ đình chỉ. Sửa thông tin cơ sở vẫn là việc của chủ sân.
 */
@Component({
  selector: 'app-platform-venues',
  templateUrl: './platform-venues.component.html',
  styleUrls: ['./platform-venues.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent]
})
export class PlatformVenuesComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly tabs = STATUS_TABS;
  readonly minReason = 10;

  readonly status = signal<AdminVenueStatus | ''>('');
  readonly keyword = signal('');
  readonly pageIndex = signal(0);
  readonly items = signal<OwnerVenueOverview[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly suspending = signal<OwnerVenueOverview | null>(null);
  readonly reason = signal('');
  readonly saving = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly reasonValid = computed(() => {
    const length = this.reason().trim().length;
    return length >= this.minReason && length <= 500;
  });

  readonly hasFilters = computed(() => !!(this.status() || this.keyword()));

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
  }

  onKeyword(value: string): void { this.search$.next(value); }

  setStatus(value: AdminVenueStatus | ''): void {
    this.status.set(value);
    this.reload();
  }

  clearFilters(): void {
    this.status.set('');
    this.keyword.set('');
    this.reload();
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  reload(): void {
    this.pageIndex.set(0);
    this.load();
  }

  load(keepList = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    (keepList ? this.paging : this.loading).set(true);
    this.request = this.repository.getVenues({
      status: this.status() || undefined,
      query: this.keyword() || undefined,
      page: this.pageIndex(),
      size: this.pageSize
    }).pipe(finalize(() => { this.loading.set(false); this.paging.set(false); }))
      .subscribe({
        next: page => { this.items.set(page.items); this.total.set(page.total); },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được danh sách cơ sở.')
      });
  }

  openSuspend(venue: OwnerVenueOverview): void {
    this.reason.set('');
    this.actionError.set(null);
    this.suspending.set(venue);
  }

  closeSuspend(): void {
    if (!this.saving()) this.suspending.set(null);
  }

  confirmSuspend(): void {
    const venue = this.suspending();
    if (!venue || !this.reasonValid() || this.saving()) return;
    this.saving.set(true);
    this.actionError.set(null);
    this.repository.suspend(venue.venueId, this.reason().trim())
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.suspending.set(null);
          this.replace(updated);
          this.notice.set(`Đã đình chỉ ${venue.name}. Chủ sân đã được thông báo.`);
        },
        error: err => this.actionError.set(err?.error?.message ?? 'Không đình chỉ được cơ sở. Vui lòng thử lại.')
      });
  }

  reinstate(venue: OwnerVenueOverview): void {
    const data: ConfirmDialogData = {
      title: 'Gỡ đình chỉ cơ sở?',
      message: `${venue.name} sẽ hiển thị lại trong tìm kiếm và nhận đặt sân ngay.`,
      confirmText: 'Gỡ đình chỉ',
      cancelText: 'Hủy',
      confirmColor: 'primary'
    };
    this.dialog.open(ConfirmDialogComponent, { width: '450px', data, panelClass: 'custom-premium-dialog' })
      .afterClosed().subscribe(confirmed => {
        if (!confirmed) return;
        this.repository.reinstate(venue.venueId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: updated => {
            this.replace(updated);
            this.notice.set(`Đã mở lại ${venue.name}.`);
          },
          error: err => this.error.set(err?.error?.message ?? 'Không gỡ được đình chỉ. Vui lòng thử lại.')
        });
      });
  }

  statusOf(venue: OwnerVenueOverview): { label: string; tone: string } {
    if (venue.suspendedAt) return { label: 'Bị đình chỉ', tone: 'danger' };
    return venue.active ? { label: 'Đang mở', tone: 'success' } : { label: 'Chủ sân tạm tắt', tone: 'neutral' };
  }

  place(venue: OwnerVenueOverview): string {
    return [venue.district, venue.city].filter(Boolean).join(', ') || venue.address || '—';
  }

  rating(venue: OwnerVenueOverview): string {
    return (venue.averageRating ?? 0).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /** Sau khi đình chỉ/gỡ, dòng đổi trạng thái tại chỗ; nếu đang lọc theo trạng thái khác thì bỏ khỏi danh sách. */
  private replace(updated: OwnerVenueOverview): void {
    const filter = this.status();
    const matches = !filter || filter === (updated.suspendedAt ? 'SUSPENDED' : updated.active ? 'ACTIVE' : 'INACTIVE');
    this.items.update(list => matches
      ? list.map(item => item.venueId === updated.venueId ? { ...item, ...updated } : item)
      : list.filter(item => item.venueId !== updated.venueId));
    if (!matches) this.total.update(total => Math.max(0, total - 1));
  }
}
