import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, of, switchMap, take } from 'rxjs';
import {
  OwnerRevenueReport,
  OwnerRevenueStatusBreakdown
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-owner-revenue',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './owner-revenue.component.html',
  styleUrl: './owner-revenue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerRevenueComponent {
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly getRevenue = inject(GetOwnerRevenueUseCase);
  private readonly destroyRef = inject(DestroyRef);

  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly selectedVenueId = signal('');
  readonly fromDate = signal(this.monthStart());
  readonly toDate = signal(this.monthEnd());
  readonly report = signal<OwnerRevenueReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedVenueName = computed(() =>
    this.venues().find(venue => venue.venueId === this.selectedVenueId())?.name ?? 'Tất cả cơ sở'
  );
  readonly invalidRange = computed(() => {
    if (!this.fromDate() || !this.toDate()) return true;
    return this.fromDate() > this.toDate() || this.rangeDays() > 366;
  });
  readonly maxDailyRevenue = computed(() => Math.max(
    0, ...(this.report()?.dailyRevenue.map(point => point.revenue) ?? [])
  ));

  constructor() {
    this.loadContext();
  }

  loadContext(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.report.set(null);
    this.getVenues.execute().pipe(
      take(1),
      switchMap(venues => {
        this.venues.set(venues);
        if (!venues.length) return of(null);
        return this.getRevenue.execute(this.filter());
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: report => this.report.set(report),
      error: error => this.error.set(this.errorMessage(error))
    });
  }

  loadReport(): void {
    if (this.loading() || this.invalidRange() || !this.venues().length) return;
    this.loading.set(true);
    this.error.set(null);
    this.report.set(null);
    this.getRevenue.execute(this.filter()).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: report => this.report.set(report),
      error: error => this.error.set(this.errorMessage(error))
    });
  }

  retry(): void {
    if (this.venues().length) this.loadReport();
    else this.loadContext();
  }

  selectVenue(event: Event): void {
    this.selectedVenueId.set((event.target as HTMLSelectElement).value);
  }

  selectFromDate(event: Event): void {
    this.fromDate.set((event.target as HTMLInputElement).value);
  }

  selectToDate(event: Event): void {
    this.toDate.set((event.target as HTMLInputElement).value);
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: this.report()?.currency ?? 'VND', maximumFractionDigits: 0
    }).format(value);
  }

  compactMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact', maximumFractionDigits: 1
    }).format(value);
  }

  percentage(value: number | null | undefined): string {
    if (value === undefined || value === null) return 'Chưa có cơ sở so sánh';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)}%`;
  }

  trendClass(value: number | null | undefined): string {
    if (value === undefined || value === null || value === 0) return 'neutral';
    return value > 0 ? 'positive' : 'negative';
  }

  trendIcon(value: number | null | undefined): string {
    return value !== undefined && value !== null && value < 0 ? 'trending-down' : 'trending-up';
  }

  barHeight(value: number): number {
    const maximum = this.maxDailyRevenue();
    if (!maximum || !value) return 0;
    return Math.max(4, Math.round((value / maximum) * 100));
  }

  shortDate(value: string): string {
    const [, month, day] = value.split('-');
    return `${day}/${month}`;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      CREATED: 'Đã tạo', PENDING: 'Đang xử lý', SUCCEEDED: 'Thành công',
      FAILED: 'Thất bại', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
      PARTIALLY_REFUNDED: 'Hoàn một phần', REFUNDED: 'Đã hoàn'
    };
    return labels[status] ?? status;
  }

  statusShare(row: OwnerRevenueStatusBreakdown): number {
    const total = this.report()?.paymentStatusBreakdown
      .reduce((sum, item) => sum + item.paymentCount, 0) ?? 0;
    return total ? Math.round((row.paymentCount / total) * 100) : 0;
  }

  private filter() {
    return {
      venueId: this.selectedVenueId() || undefined,
      fromDate: this.fromDate(),
      toDate: this.toDate()
    };
  }

  private monthStart(): string {
    const now = new Date();
    return this.localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private monthEnd(): string {
    const now = new Date();
    return this.localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  private localDate(value: Date): string {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  private rangeDays(): number {
    const start = new Date(`${this.fromDate()}T00:00:00`);
    const end = new Date(`${this.toDate()}T00:00:00`);
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  private errorMessage(error: unknown): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message || candidate?.message || 'Không thể tải dữ liệu doanh thu.';
  }
}
