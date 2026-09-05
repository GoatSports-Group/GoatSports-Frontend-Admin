import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap, take } from 'rxjs';
import {
  OwnerRevenueReport,
  OwnerRevenueStatusBreakdown
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

type RevenuePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface RevenuePresetOption {
  value: RevenuePreset;
  label: string;
}

interface VenueRevenueRanking {
  venueId: string;
  venueName: string;
  totalRevenue: number;
  bookingCount: number;
  paidBookingCount: number;
}

interface RevenueChartPoint {
  date: string;
  revenue: number;
  x: number;
  y: number;
}

interface RevenueLoadResult {
  report: OwnerRevenueReport | null;
  ranking: VenueRevenueRanking[];
}

@Component({
  selector: 'app-owner-revenue',
  standalone: true,
  imports: [LucideIconComponent, PageLoadingComponent],
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
  readonly selectedPreset = signal<RevenuePreset>('month');
  readonly fromDate = signal(this.monthStart());
  readonly toDate = signal(this.monthEnd());
  readonly report = signal<OwnerRevenueReport | null>(null);
  readonly venueRanking = signal<VenueRevenueRanking[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rankingError = signal<string | null>(null);

  readonly presets: readonly RevenuePresetOption[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'week', label: 'Tuần' },
    { value: 'month', label: 'Tháng' },
    { value: 'quarter', label: 'Quý' },
    { value: 'year', label: 'Năm' },
    { value: 'custom', label: 'Tùy chỉnh' }
  ];

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
  readonly averageRevenuePerPaidBooking = computed(() => {
    const period = this.report()?.currentPeriod;
    return period?.paidBookingCount ? period.totalRevenue / period.paidBookingCount : 0;
  });
  readonly paidBookingRate = computed(() => {
    const period = this.report()?.currentPeriod;
    return period?.bookingCount ? period.paidBookingCount * 100 / period.bookingCount : 0;
  });
  readonly revenueDifference = computed(() => {
    const data = this.report();
    return data ? data.currentPeriod.totalRevenue - data.previousPeriod.totalRevenue : 0;
  });
  readonly rankingMaximum = computed(() => this.venueRanking()[0]?.totalRevenue ?? 0);
  readonly chartMaximum = computed(() => this.niceMaximum(this.maxDailyRevenue()));
  readonly chartTicks = computed(() => Array.from({ length: 5 }, (_, index) => ({
    value: this.chartMaximum() * (4 - index) / 4,
    y: 22 + index * 43
  })));
  readonly chartPoints = computed<readonly RevenueChartPoint[]>(() => {
    const rows = [...(this.report()?.dailyRevenue ?? [])].sort((left, right) => left.date.localeCompare(right.date));
    const maximum = this.chartMaximum();
    return rows.map((row, index) => ({
      ...row,
      x: rows.length === 1 ? 500 : 52 + index * 918 / (rows.length - 1),
      y: 194 - row.revenue * 172 / maximum
    }));
  });
  readonly chartLinePath = computed(() => this.chartPoints()
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
    .join(' '));
  readonly chartAreaPath = computed(() => {
    const points = this.chartPoints();
    if (!points.length) return '';
    return `${this.chartLinePath()} L ${points.at(-1)!.x} 194 L ${points[0].x} 194 Z`;
  });
  readonly chartLabels = computed(() => {
    const points = this.chartPoints();
    if (!points.length) return [];
    const step = Math.max(1, Math.ceil((points.length - 1) / 6));
    return points.filter((_, index) => index % step === 0 || index === points.length - 1);
  });

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
        if (!venues.length) return of({ report: null, ranking: [] } satisfies RevenueLoadResult);
        return this.revenueRequest(venues);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => this.applyResult(result),
      error: error => this.error.set(this.errorMessage(error))
    });
  }

  loadReport(): void {
    if (this.loading() || this.invalidRange() || !this.venues().length) return;
    this.loading.set(true);
    this.error.set(null);
    this.rankingError.set(null);
    this.report.set(null);
    this.venueRanking.set([]);
    this.revenueRequest(this.venues()).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => this.applyResult(result),
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

  selectPreset(preset: RevenuePreset): void {
    if (this.loading()) return;
    this.selectedPreset.set(preset);
    if (preset === 'custom') return;
    const range = this.presetRange(preset);
    this.fromDate.set(range.fromDate);
    this.toDate.set(range.toDate);
    this.loadReport();
  }

  selectFromDate(event: Event): void {
    this.selectedPreset.set('custom');
    this.fromDate.set((event.target as HTMLInputElement).value);
  }

  selectToDate(event: Event): void {
    this.selectedPreset.set('custom');
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

  fullDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`));
  }

  periodName(): string {
    return this.presets.find(option => option.value === this.selectedPreset())?.label ?? 'Tùy chỉnh';
  }

  rankingWidth(value: number): number {
    const maximum = this.rankingMaximum();
    return maximum ? Math.max(value ? 5 : 0, Math.round(value * 100 / maximum)) : 0;
  }

  chartMoney(value: number): string {
    if (!value) return '0';
    return `${this.compactMoney(value)}đ`;
  }

  signedMoney(value: number): string {
    const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${prefix}${this.money(Math.abs(value))}`;
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

  private revenueRequest(venues: readonly OwnerVenueOverview[]): Observable<RevenueLoadResult> {
    return forkJoin({
      report: this.getRevenue.execute(this.filter()),
      ranking: this.rankingRequest(venues)
    });
  }

  private rankingRequest(venues: readonly OwnerVenueOverview[]): Observable<VenueRevenueRanking[]> {
    if (!venues.length) return of([]);
    return forkJoin(venues.map(venue => this.getRevenue.execute({
      venueId: venue.venueId,
      fromDate: this.fromDate(),
      toDate: this.toDate()
    }).pipe(
      take(1),
      map(report => ({
        venueId: venue.venueId,
        venueName: venue.name,
        totalRevenue: report.currentPeriod.totalRevenue,
        bookingCount: report.currentPeriod.bookingCount,
        paidBookingCount: report.currentPeriod.paidBookingCount
      } satisfies VenueRevenueRanking)),
      catchError(() => of(null))
    ))).pipe(map(rows => {
      const available = rows.filter((row): row is VenueRevenueRanking => row !== null);
      if (available.length !== venues.length) {
        this.rankingError.set('Một số cơ sở chưa trả dữ liệu nên bảng xếp hạng có thể chưa đầy đủ.');
      }
      return available.sort((left, right) =>
        right.totalRevenue - left.totalRevenue || right.paidBookingCount - left.paidBookingCount
      );
    }));
  }

  private applyResult(result: RevenueLoadResult): void {
    this.report.set(result.report);
    this.venueRanking.set(result.ranking);
  }

  private presetRange(preset: Exclude<RevenuePreset, 'custom'>): { fromDate: string; toDate: string } {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let end = new Date(start);
    if (preset === 'week') {
      const offset = (now.getDay() + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'quarter') {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterStart, 1);
      end = new Date(now.getFullYear(), quarterStart + 3, 0);
    } else if (preset === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }
    return { fromDate: this.localDate(start), toDate: this.localDate(end) };
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

  private niceMaximum(value: number): number {
    if (value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    return Math.ceil(value / power) * power;
  }

  private errorMessage(error: unknown): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message || candidate?.message || 'Không thể tải dữ liệu doanh thu.';
  }
}
