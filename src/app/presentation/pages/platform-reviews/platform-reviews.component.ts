import { PAGE_SIZE } from '@shared/constants/page-size';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, finalize } from 'rxjs';
import { OwnerReview, OwnerReviewStatus } from '@application/dto/owner-review/owner-review.dto';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { aiVerdictLabel, aiVerdictTone } from '@shared/utils/ai-verdict';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { MatMenuModule } from '@angular/material/menu';

const STATUS_META: Record<OwnerReviewStatus, { label: string; tone: string }> = {
  PUBLISHED: { label: 'Đang hiển thị', tone: 'success' },
  HIDDEN: { label: 'Đã ẩn', tone: 'warning' },
  REMOVED: { label: 'Đã gỡ', tone: 'neutral' }
};

/**
 * Kiểm duyệt đánh giá cơ sở của người chơi. Ẩn là tạm thời (hiện lại được), gỡ là vĩnh viễn; cả hai đều loại
 * đánh giá khỏi điểm trung bình của cơ sở.
 */
@Component({
  selector: 'app-platform-reviews',
  templateUrl: './platform-reviews.component.html',
  styleUrls: ['./platform-reviews.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, MatMenuModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent,
    SelectComponent]
})
export class PlatformReviewsComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly statusMeta = STATUS_META;
  readonly statusOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi trạng thái' },
    ...(Object.keys(STATUS_META) as OwnerReviewStatus[]).map(value => ({ value, label: STATUS_META[value].label }))
  ];
  readonly ratingOptions: readonly SelectOption[] = [
    { value: 0, label: 'Mọi số sao' },
    ...[1, 2, 3, 4, 5].map(value => ({ value, label: `${value} sao` }))
  ];

  readonly status = signal<OwnerReviewStatus | ''>('');
  readonly rating = signal(0);
  readonly venueId = signal<string | null>(null);
  readonly venueName = signal<string | null>(null);
  readonly pageIndex = signal(0);
  readonly items = signal<OwnerReview[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  /** Chỉ đánh giá AI nghi vi phạm (mức 2–3). AI chỉ gợi ý; ẩn hay gỡ vẫn do admin bấm. */
  readonly aiFlagged = signal(false);
  readonly aiLabel = aiVerdictLabel;
  readonly aiTone = aiVerdictTone;

  readonly hasFilters = computed(() => !!(this.status() || this.rating() || this.venueId() || this.aiFlagged()));

  ngOnInit(): void {
    // Mở từ trang Cơ sở: lọc sẵn theo cơ sở đó.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.venueId.set(params.get('venueId'));
      this.venueName.set(params.get('venueName'));
      this.reload();
    });
  }

  setStatus(value: OwnerReviewStatus | ''): void {
    this.status.set(value);
    this.reload();
  }

  setRating(value: number): void {
    this.rating.set(Number(value) || 0);
    this.reload();
  }

  toggleAiFlagged(): void {
    this.aiFlagged.update(on => !on);
    this.reload();
  }

  clearVenue(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  clearFilters(): void {
    this.status.set('');
    this.rating.set(0);
    this.aiFlagged.set(false);
    if (this.venueId()) this.clearVenue();
    else this.reload();
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
    this.request = this.repository.getReviews({
      status: this.status() || undefined,
      rating: this.rating() || undefined,
      venueId: this.venueId() ?? undefined,
      aiFlagged: this.aiFlagged() || undefined,
      page: this.pageIndex(),
      size: this.pageSize
    }).pipe(finalize(() => { this.loading.set(false); this.paging.set(false); }))
      .subscribe({
        next: page => { this.items.set(page.items); this.total.set(page.total); },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được danh sách đánh giá.')
      });
  }

  moderate(review: OwnerReview, target: OwnerReviewStatus): void {
    if (target !== 'REMOVED') {
      this.apply(review, target);
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Gỡ vĩnh viễn đánh giá?',
      message: 'Đánh giá biến mất khỏi trang cơ sở và không khôi phục được. Dùng "Ẩn" nếu cần xem xét thêm.',
      confirmText: 'Gỡ đánh giá',
      cancelText: 'Hủy',
      confirmColor: 'warn'
    };
    this.dialog.open(ConfirmDialogComponent, { width: '450px', data, panelClass: 'custom-premium-dialog' })
      .afterClosed().subscribe(confirmed => { if (confirmed) this.apply(review, target); });
  }

  stars(rating: number): readonly boolean[] {
    return [1, 2, 3, 4, 5].map(value => value <= rating);
  }

  time(value: string): string { return value?.slice(0, 5) ?? ''; }

  private apply(review: OwnerReview, target: OwnerReviewStatus): void {
    this.busyId.set(review.reviewId);
    this.error.set(null);
    this.repository.moderateReview(review.reviewId, target)
      .pipe(finalize(() => this.busyId.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          const filter = this.status();
          if (filter && filter !== result.status) {
            this.items.update(list => list.filter(item => item.reviewId !== review.reviewId));
            this.total.update(total => Math.max(0, total - 1));
          } else {
            this.items.update(list => list.map(item =>
              item.reviewId === review.reviewId ? { ...item, status: result.status } : item));
          }
          this.notice.set(target === 'PUBLISHED' ? 'Đã hiện lại đánh giá.' : target === 'HIDDEN' ? 'Đã ẩn đánh giá.' : 'Đã gỡ đánh giá.');
        },
        error: err => this.error.set(err?.error?.message ?? 'Không cập nhật được đánh giá. Vui lòng thử lại.')
      });
  }
}
