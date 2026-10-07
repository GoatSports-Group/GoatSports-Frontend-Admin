import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, of, switchMap, take } from 'rxjs';
import { OwnerReview, OwnerReviewFilter } from '@application/dto/owner-review/owner-review.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetOwnerReviewsUseCase } from '@application/usecase/owner-review/get-owner-reviews.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';

@Component({
  selector: 'app-owner-reviews',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, LucideIconComponent, PageLoadingComponent, PaginationComponent, SelectComponent],
  templateUrl: './owner-reviews.component.html',
  styleUrl: './owner-reviews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerReviewsComponent {
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly getReviews = inject(GetOwnerReviewsUseCase);
  private readonly destroyRef = inject(DestroyRef);

  readonly stars = [1, 2, 3, 4, 5];
  readonly ratingOptions: readonly SelectOption[] = [
    { value: '', label: 'Tất cả mức' }, ...this.stars.map(star => ({ value: star, label: `${star} sao` }))
  ];
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly reviews = signal<OwnerReview[]>([]);
  readonly selectedVenueId = signal('');
  readonly selectedCourtId = signal('');
  readonly selectedRating = signal<number | null>(null);
  readonly fromDate = signal(this.monthStart());
  readonly toDate = signal(this.today());
  readonly total = signal(0);
  readonly pageSize = PAGE_SIZE.table;
  /** Doi trang: giu trang hien tai (lam mo) thay vi skeleton. */
  readonly paging = signal(false);
  readonly page = signal(0);
  readonly pages = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly venueOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Tất cả cơ sở' }, ...this.venues().map(venue => ({ value: venue.venueId, label: venue.name }))
  ]);
  readonly courts = computed(() => this.venues()
    .find(venue => venue.venueId === this.selectedVenueId())?.courts ?? []);
  readonly courtOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Tất cả sân' }, ...this.courts().map(court => ({ value: court.venueCourtId, label: court.name }))
  ]);
  readonly invalidRange = computed(() => {
    if (!this.fromDate() || !this.toDate()) return false;
    return this.fromDate() > this.toDate() || this.rangeDays() > 366;
  });

  constructor() { this.loadContext(); }

  loadContext(): void {
    if (this.loading()) return;
    this.beginLoad();
    this.getVenues.execute().pipe(
      take(1),
      switchMap(venues => {
        this.venues.set(venues);
        return venues.length ? this.getReviews.execute(this.filter(0)) : of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => result ? this.applyPage(result) : this.clearPage(),
      error: error => this.fail(error)
    });
  }

  loadReviews(page = 0): void {
    if (this.loading() || this.invalidRange() || !this.venues().length) return;
    this.beginLoad();
    this.getReviews.execute(this.filter(page)).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))
    ).subscribe({ next: result => this.applyPage(result), error: error => this.fail(error) });
  }

  retry(): void { this.venues().length ? this.loadReviews(this.page()) : this.loadContext(); }
  selectVenue(value: string): void {
    this.selectedVenueId.set(value);
    this.selectedCourtId.set('');
  }
  selectCourt(value: string): void {
    this.selectedCourtId.set(value);
  }
  selectRating(value: number | ''): void {
    this.selectedRating.set(value ? Number(value) : null);
  }
  selectFromDate(value: string): void {
    this.fromDate.set(value);
  }
  selectToDate(value: string): void {
    this.toDate.set(value);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.pages() || page === this.page() || this.paging()) return;
    this.paging.set(true);
    this.getReviews.execute(this.filter(page)).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.paging.set(false))
    ).subscribe({
      next: result => { this.applyPage(result); queueMicrotask(() => this.scrollListIntoView()); },
      error: error => this.fail(error)
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PUBLISHED: 'Đã xuất bản', HIDDEN: 'Đã ẩn', REMOVED: 'Đã gỡ'
    };
    return labels[status] ?? status;
  }
  dateTime(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date(value));
  }
  playTime(review: OwnerReview): string {
    const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
      .format(new Date(`${review.playDate}T00:00:00`));
    return `${date} · ${review.startTime.slice(0, 5)}–${review.endTime.slice(0, 5)}`;
  }

  private beginLoad(): void {
    this.loading.set(true); this.error.set(null); this.clearPage();
  }
  private clearPage(): void {
    this.reviews.set([]); this.total.set(0); this.page.set(0); this.pages.set(0);
  }
  private applyPage(result: { items: OwnerReview[]; total: number; page: number; pages: number }): void {
    this.reviews.set(result.items); this.total.set(result.total);
    this.page.set(result.page); this.pages.set(result.pages);
  }
  private fail(error: unknown): void {
    this.clearPage();
    const candidate = error as { error?: { message?: string | string[] }; message?: string };
    const message = candidate?.error?.message;
    this.error.set(Array.isArray(message)
      ? message.join(' ') : message || candidate?.message || 'Không thể tải danh sách đánh giá.');
  }
  private filter(page: number): OwnerReviewFilter {
    return {
      venueId: this.selectedVenueId() || undefined,
      venueCourtId: this.selectedCourtId() || undefined,
      rating: this.selectedRating() ?? undefined,
      fromDate: this.fromDate() || undefined,
      toDate: this.toDate() || undefined,
      page, size: this.pageSize
    };
  }
  private today(): string { return this.localDate(new Date()); }
  private monthStart(): string {
    const now = new Date(); return this.localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }
  private localDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  private rangeDays(): number {
    const start = new Date(`${this.fromDate()}T00:00:00`);
    const end = new Date(`${this.toDate()}T00:00:00`);
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  /** Doi trang xong: dua dau danh sach vao tam nhin neu no da troi len tren. */
  private scrollListIntoView(): void {
    const element = document.querySelector<HTMLElement>('[data-list-top]');
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
