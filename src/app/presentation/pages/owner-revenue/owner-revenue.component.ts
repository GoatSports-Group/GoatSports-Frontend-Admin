import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { TwoWayWindow } from '@shared/utils/two-way-window';
import { TournamentRevenueEntry } from '@application/dto/owner-tournament/owner-tournament.dto';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, ElementRef, HostListener, Injector, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subject, catchError, finalize, forkJoin, map, of, switchMap, take, takeUntil } from 'rxjs';
import {
  OwnerRevenueReport,
  OwnerRevenueReportExportFilter,
  OwnerRevenueStatusBreakdown
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OwnerTournamentRevenue } from '@application/dto/owner-tournament/owner-tournament.dto';
import { OWNER_TOURNAMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-tournament.repository';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { RouterLink } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';

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

type ChartGranularity = 'day' | 'week' | 'month';

// Vung ve trong viewBox 1000 x 250: chua 64px ben trai cho nhan tien, 22px duoi cho nhan ngay.
const CHART_LEFT = 64;
const CHART_WIDTH = 924;
const CHART_TOP = 14;
const CHART_HEIGHT = 196;

interface RevenueChartBar {
  key: string;
  label: string;
  title: string;
  revenue: number;
  x: number;
  y: number;
  width: number;
  height: number;
  showLabel: boolean;
  /** Ghi so tien tren dau cot: moi cot co doanh thu, tru nhan de len nhan cua cot cao hon ben canh. */
  showValue: boolean;
  peak: boolean;
}

interface RevenueLoadResult {
  report: OwnerRevenueReport | null;
  ranking: VenueRevenueRanking[];
  /** Lệ phí giải (+) và giải thưởng (−) của chủ sân trong kỳ; null nếu club-service chưa trả được. */
  tournaments?: OwnerTournamentRevenue | null;
}

@Component({
  selector: 'app-owner-revenue',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, DatePipe, LucideIconComponent, PageLoadingComponent, RouterLink, SelectComponent, InfiniteScrollDirective, NgTemplateOutlet],
  templateUrl: './owner-revenue.component.html',
  styleUrl: './owner-revenue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerRevenueComponent {
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly getRevenue = inject(GetOwnerRevenueUseCase);
  private readonly tournamentRepository = inject(OWNER_TOURNAMENT_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly notify = inject(NotifyService);

  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly venueOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Tất cả cơ sở' }, ...this.venues().map(venue => ({ value: venue.venueId, label: venue.name }))
  ]);
  readonly selectedVenueId = signal('');
  readonly selectedPreset = signal<RevenuePreset>('month');
  readonly fromDate = signal(this.monthStart());
  readonly toDate = signal(this.monthEnd());
  readonly report = signal<OwnerRevenueReport | null>(null);
  readonly tournamentRevenue = signal<OwnerTournamentRevenue | null>(null);
  /** Doanh thu tổng = đặt sân + phần ròng từ giải đấu (lệ phí trừ giải thưởng). */
  readonly combinedRevenue = computed(() =>
    (this.report()?.currentPeriod.totalRevenue ?? 0) + (this.tournamentRevenue()?.net ?? 0));
  readonly venueRanking = signal<VenueRevenueRanking[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rankingError = signal<string | null>(null);
  readonly reportPreviewOpen = signal(false);
  readonly reportPreviewLoading = signal(false);
  readonly reportPreviewError = signal<string | null>(null);
  readonly reportPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly exporting = signal(false);
  private readonly stopReportPreview = new Subject<void>();
  private reportPreviewObjectUrl: string | null = null;
  private activeReportFilter: OwnerRevenueReportExportFilter | null = null;
  private appliedPeriodLabel = 'Tháng';

  readonly presets: readonly RevenuePresetOption[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'week', label: 'Tuần' },
    { value: 'month', label: 'Tháng' },
    { value: 'quarter', label: 'Quý' },
    { value: 'year', label: 'Năm' }
  ];

  readonly selectedVenueName = computed(() =>
    this.venues().find(venue => venue.venueId === this.selectedVenueId())?.name ?? 'Tất cả cơ sở'
  );
  readonly invalidRange = computed(() => {
    if (!this.fromDate() || !this.toDate()) return true;
    return this.fromDate() > this.toDate() || this.rangeDays() > 366;
  });
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
  /** Xu huong doanh thu: <= 31 ngay ve theo ngay, <= 120 ngay theo tuan (thu Hai), dai hon theo thang. */
  readonly chartGranularity = computed<ChartGranularity>(() => {
    const period = this.report()?.currentPeriod;
    if (!period) return 'day';
    const days = Math.round((this.parseDate(period.toDate).getTime() - this.parseDate(period.fromDate).getTime()) / 86_400_000) + 1;
    return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
  });
  readonly chartUnitLabel = computed(() => ({ day: 'ngày', week: 'tuần', month: 'tháng' })[this.chartGranularity()]);
  private readonly chartBuckets = computed(() => {
    const data = this.report();
    if (!data) return [];
    const unit = this.chartGranularity();
    const revenueByDate = new Map(data.dailyRevenue.map(row => [row.date, row.revenue]));
    const buckets = new Map<string, { start: string; end: string; revenue: number }>();
    const last = this.parseDate(data.currentPeriod.toDate);
    for (let day = this.parseDate(data.currentPeriod.fromDate); day <= last; day.setDate(day.getDate() + 1)) {
      const iso = this.isoDate(day);
      const key = unit === 'day' ? iso : unit === 'month' ? iso.slice(0, 7) : this.isoDate(this.weekStart(day));
      const bucket = buckets.get(key) ?? { start: iso, end: iso, revenue: 0 };
      bucket.end = iso;
      bucket.revenue += revenueByDate.get(iso) ?? 0;
      buckets.set(key, bucket);
    }
    return [...buckets.entries()].map(([key, bucket]) => ({ key, ...bucket }));
  });
  readonly chartMaximum = computed(() => this.niceMaximum(Math.max(0, ...this.chartBuckets().map(bucket => bucket.revenue))));
  readonly chartTicks = computed(() => Array.from({ length: 5 }, (_, index) => ({
    value: this.chartMaximum() * (4 - index) / 4,
    y: CHART_TOP + index * CHART_HEIGHT / 4
  })));
  readonly chartBars = computed<readonly RevenueChartBar[]>(() => {
    const buckets = this.chartBuckets();
    if (!buckets.length) return [];
    const unit = this.chartGranularity();
    const maximum = this.chartMaximum();
    const slot = CHART_WIDTH / buckets.length;
    const width = Math.max(2, Math.min(44, slot * .62));
    const labelEvery = slot >= 40 ? 1 : Math.ceil(buckets.length / 8);
    const peak = buckets.reduce((best, bucket) => bucket.revenue > best.revenue ? bucket : best, buckets[0]);
    const multiYear = buckets[0].start.slice(0, 4) !== buckets.at(-1)!.start.slice(0, 4);
    const bars = buckets.map((bucket, index) => {
      const height = bucket.revenue ? Math.max(3, bucket.revenue * CHART_HEIGHT / maximum) : 0;
      return {
        key: bucket.key,
        label: unit === 'month'
          ? `T${Number(bucket.start.slice(5, 7))}${multiYear ? '/' + bucket.start.slice(2, 4) : ''}`
          : this.shortDate(bucket.start),
        title: unit === 'day' ? this.fullDate(bucket.start)
          : unit === 'week' ? `${this.shortDate(bucket.start)} – ${this.shortDate(bucket.end)}`
            : `Tháng ${bucket.start.slice(5, 7)}/${bucket.start.slice(0, 4)}`,
        revenue: bucket.revenue,
        x: CHART_LEFT + index * slot + (slot - width) / 2,
        y: CHART_TOP + CHART_HEIGHT - height,
        width,
        height,
        showLabel: index % labelEvery === 0 || index === buckets.length - 1 && buckets.length <= 8,
        peak: bucket === peak && bucket.revenue > 0,
        showValue: false
      };
    });
    // Ghi so tien tren moi cot co doanh thu; cot cao hon duoc uu tien, nhan nao de len nhan da dat thi bo
    // (uoc luong 7 don vi viewBox moi ky tu chu 12px).
    const placed: { center: number; half: number }[] = [];
    for (const bar of [...bars].filter(item => item.revenue > 0).sort((left, right) => right.revenue - left.revenue)) {
      const center = bar.x + bar.width / 2;
      const half = (this.chartMoney(bar.revenue).length * 7 + 6) / 2;
      if (placed.some(label => Math.abs(label.center - center) < label.half + half)) continue;
      placed.push({ center, half });
      bar.showValue = true;
    }
    return bars;
  });
  readonly chartPeak = computed(() => this.chartBars().find(bar => bar.peak) ?? null);
  readonly chartActiveCount = computed(() => this.chartBars().filter(bar => bar.revenue > 0).length);
  readonly chartAverage = computed(() => {
    const bars = this.chartBars();
    return bars.length ? bars.reduce((total, bar) => total + bar.revenue, 0) / bars.length : 0;
  });

  /** Doanh thu giai dau: 3 muc gan nhat tren trang, "Xem them" mo popup cuon vo han hai chieu. */
  readonly tournamentEntries = computed<readonly TournamentRevenueEntry[]>(() =>
    [...(this.tournamentRevenue()?.entries ?? [])].sort((left, right) => right.date.localeCompare(left.date)));
  readonly recentTournamentEntries = computed(() => this.tournamentEntries().slice(0, 3));
  readonly tournamentEntriesOpen = signal(false);
  readonly tournamentWindow = new TwoWayWindow(this.tournamentEntries, entry => this.entryKey(entry), inject(Injector));
  private readonly tournamentListRef = viewChild<ElementRef<HTMLElement>>('tournamentEntryList');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopReportPreview.next();
      this.stopReportPreview.complete();
      this.releaseReportPreviewUrl();
    });
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

  openReportPreview(): void {
    if (this.reportPreviewLoading() || this.exporting()) return;
    const reportFilter = this.currentReportFilter();
    if (!reportFilter) return;

    this.stopReportPreview.next();
    this.releaseReportPreviewUrl();
    this.activeReportFilter = reportFilter;
    this.reportPreviewOpen.set(true);
    this.reportPreviewLoading.set(true);
    this.reportPreviewError.set(null);
    this.getRevenue.previewReport(reportFilter).pipe(
      take(1),
      takeUntil(this.stopReportPreview),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.reportPreviewLoading.set(false))
    ).subscribe({
      next: file => {
        if (!file.size) {
          this.reportPreviewError.set('Dịch vụ báo cáo không trả dữ liệu xem trước.');
          return;
        }
        this.reportPreviewObjectUrl = URL.createObjectURL(file);
        this.reportPreviewUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(this.reportPreviewObjectUrl)
        );
      },
      error: error => this.reportPreviewError.set(
        this.errorMessage(error, 'Không thể tạo bản xem trước báo cáo doanh thu.')
      )
    });
  }

  closeReportPreview(): void {
    if (this.exporting()) return;
    this.stopReportPreview.next();
    this.releaseReportPreviewUrl();
    this.reportPreviewError.set(null);
    this.reportPreviewOpen.set(false);
    this.activeReportFilter = null;
  }

  exportRevenueReport(): void {
    if (this.exporting() || !this.activeReportFilter) return;
    const filter = this.activeReportFilter;
    this.exporting.set(true);
    this.getRevenue.exportReport(filter).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.exporting.set(false))
    ).subscribe({
      next: file => {
        if (!file.size) {
          this.notify.error('Dịch vụ báo cáo không trả dữ liệu Excel.');
          return;
        }
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `bao-cao-doanh-thu-${filter.fromDate}-${filter.toDate}.xlsx`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        this.notify.success('Đã xuất báo cáo doanh thu.');
      },
      error: error => this.notify.error(
        this.errorMessage(error, 'Không thể xuất báo cáo doanh thu Excel.')
      )
    });
  }

  selectVenue(value: string): void {
    this.selectedVenueId.set(value);
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

  selectFromDate(value: string): void {
    this.selectedPreset.set('custom');
    this.fromDate.set(value);
  }

  selectToDate(value: string): void {
    this.selectedPreset.set('custom');
    this.toDate.set(value);
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: this.report()?.currency ?? 'VND', maximumFractionDigits: 0
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

  activeReportDescription(): string {
    const filter = this.activeReportFilter;
    if (!filter) return 'Kiểm tra bố cục và số liệu trước khi xuất tệp Excel.';
    return `${filter.periodLabel} · ${filter.venueName} · ${this.fullDate(filter.fromDate)} – ${this.fullDate(filter.toDate)}`;
  }

  rankingWidth(value: number): number {
    const maximum = this.rankingMaximum();
    return maximum ? Math.max(value ? 5 : 0, Math.round(value * 100 / maximum)) : 0;
  }

  /** Nhan truc tien gon: 800k, 1,2tr, 2,5 tỷ. */
  chartMoney(value: number): string {
    if (!value) return '0';
    const format = (amount: number) => amount.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    if (value >= 1e9) return `${format(value / 1e9)} tỷ`;
    if (value >= 1e6) return `${format(value / 1e6)}tr`;
    if (value >= 1e3) return `${format(value / 1e3)}k`;
    return format(value);
  }

  entryKey(entry: TournamentRevenueEntry): string {
    return `${entry.tournamentId}:${entry.kind}:${entry.date}`;
  }

  openTournamentEntries(): void {
    this.tournamentWindow.reset();
    this.tournamentEntriesOpen.set(true);
  }

  closeTournamentEntries(): void {
    this.tournamentEntriesOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tournamentEntriesOpen()) this.closeTournamentEntries();
  }

  showMoreTournamentEntries(): void {
    this.tournamentWindow.next(this.tournamentListRef()?.nativeElement);
  }

  showPreviousTournamentEntries(): void {
    this.tournamentWindow.previous(this.tournamentListRef()?.nativeElement);
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
    const filter = this.filter();
    return forkJoin({
      report: this.getRevenue.execute(filter),
      ranking: this.rankingRequest(venues),
      tournaments: this.tournamentRepository.getRevenue(filter.fromDate, filter.toDate, filter.venueId)
        .pipe(catchError(() => of(null)))
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
    this.tournamentRevenue.set(result.tournaments ?? null);
    if (result.report) this.appliedPeriodLabel = this.periodName();
  }

  private currentReportFilter(): OwnerRevenueReportExportFilter | null {
    const data = this.report();
    if (!data) return null;
    const venueId = data.scopeVenueId || undefined;
    const venueName = venueId
      ? this.venues().find(venue => venue.venueId === venueId)?.name ?? this.selectedVenueName()
      : 'Tất cả cơ sở';
    return {
      venueId,
      venueName,
      fromDate: data.currentPeriod.fromDate,
      toDate: data.currentPeriod.toDate,
      periodLabel: this.appliedPeriodLabel
    };
  }

  private releaseReportPreviewUrl(): void {
    if (this.reportPreviewObjectUrl) URL.revokeObjectURL(this.reportPreviewObjectUrl);
    this.reportPreviewObjectUrl = null;
    this.reportPreviewUrl.set(null);
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

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private isoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private weekStart(date: Date): Date {
    const start = new Date(date);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    return start;
  }

  private niceMaximum(value: number): number {
    if (value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    return Math.ceil(value / power) * power;
  }

  private errorMessage(error: unknown, fallback = 'Không thể tải dữ liệu doanh thu.'): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message || candidate?.message || fallback;
  }
}
