import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import {
  catchError,
  EMPTY,
  exhaustMap,
  expand,
  filter,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  reduce,
  take,
  timer
} from 'rxjs';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerBooking, OwnerBookingSource } from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerCustomerMetricsReport, OwnerRevenueReport } from '@application/dto/owner-revenue/owner-revenue.dto';
import {
  CourtAvailabilityStatus,
  OwnerVenueCourt,
  OwnerVenueOverview
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetOwnerCustomerMetricsUseCase } from '@application/usecase/owner-revenue/get-owner-customer-metrics.usecase';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { WeatherInfo } from '@shared/components/ui/weather-widget/weather-widget.models';
import { OwnerApplicationProgressComponent } from '../dashboard/owner-application-progress/owner-application-progress.component';

interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
  icon: string;
  negative?: boolean;
}

interface DailyRevenueChartPoint {
  hour: number;
  revenue: number;
  cumulativeRevenue: number;
  x: number;
  y: number;
}

const COURT_AVAILABILITY_POLL_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-venue-owner-dashboard',
  standalone: true,
  imports: [RouterModule, LucideIconComponent, PageLoadingComponent, OwnerApplicationProgressComponent],
  templateUrl: './venue-owner-dashboard.component.html',
  styleUrl: './venue-owner-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerDashboardComponent {
  private readonly getMyApplications = inject(GetMyOwnerApplicationsUseCase);
  private readonly getMyVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
  private readonly getCustomerMetrics = inject(GetOwnerCustomerMetricsUseCase);
  private readonly getRevenue = inject(GetOwnerRevenueUseCase);
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  private readonly destroyRef = inject(DestroyRef);

  readonly ownerName = input('Chủ sân');
  readonly weather = input<WeatherInfo | null>(null);
  readonly weatherLoading = input(false);
  readonly weatherError = input<string | null>(null);
  readonly retryWeather = output<void>();
  readonly applicationUrl = '/admin/applications';
  readonly courtCells = Array.from({ length: 15 });
  readonly revenueAxisHours = [0, 4, 8, 12, 16, 20, 24] as const;

  readonly applications = signal<OwnerApplication[]>([]);
  readonly applicationLoading = signal(false);
  readonly applicationError = signal<string | null>(null);
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly venueLoading = signal(false);
  readonly venueError = signal<string | null>(null);
  readonly selectedVenueId = signal<string | null>(null);
  readonly businessLoading = signal(false);
  readonly businessError = signal<string | null>(null);
  readonly dailyRevenueLoading = signal(false);
  readonly dailyRevenueError = signal<string | null>(null);
  readonly dailyRevenueReport = signal<OwnerRevenueReport | null>(null);
  readonly dailyRevenueBookings = signal<OwnerBooking[]>([]);
  readonly monthlyRevenueReport = signal<OwnerRevenueReport | null>(null);
  readonly revenueDateDraft = signal(this.localDate(new Date()));
  readonly appliedRevenueDate = signal(this.localDate(new Date()));
  readonly maximumRevenueDate = this.localDate(new Date());
  readonly upcomingBookings = signal<OwnerBooking[]>([]);
  readonly liveCourtBookings = signal<OwnerBooking[]>([]);
  readonly customerMetricsReport = signal<OwnerCustomerMetricsReport | null>(null);
  readonly bookingDetailId = signal<string | null>(null);
  readonly bookingDetail = signal<OwnerBooking | null>(null);
  readonly bookingDetailLoading = signal(false);
  readonly bookingDetailError = signal<string | null>(null);
  readonly venueCoverUrls = signal<Readonly<Record<string, string>>>({});
  readonly liveCourtsViewport = viewChild<ElementRef<HTMLElement>>('liveCourtsViewport');
  readonly canScrollCourtsBackward = signal(false);
  readonly canScrollCourtsForward = signal(false);
  readonly reviewStars = [1, 2, 3, 4, 5];
  readonly previewReviews = [
    {
      id: 'preview-review-1', initials: 'HL', rating: 5,
      content: 'Sân sạch, nhân viên hỗ trợ nhanh và nhiệt tình.', time: '12 phút trước'
    },
    {
      id: 'preview-review-2', initials: 'TK', rating: 4,
      content: 'Mặt sân tốt, khu vực chờ khá thoải mái.', time: '1 giờ trước'
    }
  ] as const;

  readonly latestApplication = computed(() => this.applications()[0] ?? null);
  readonly approvedApplication = computed(() =>
    this.applications().find(application => application.status === OwnerApplicationStatus.APPROVED) ?? null
  );
  readonly applicationApproved = computed(() => Boolean(this.approvedApplication()));
  readonly displayName = computed(() => this.ownerName().trim() || 'Chủ sân');
  readonly selectedVenue = computed(() => {
    const venueId = this.selectedVenueId();
    return this.venues().find(venue => venue.venueId === venueId) ?? this.venues()[0] ?? null;
  });
  readonly selectedVenueCoverUrl = computed(() => {
    const venueId = this.selectedVenue()?.venueId;
    return venueId ? this.venueCoverUrls()[venueId] ?? null : null;
  });
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  });
  readonly todayLabel = computed(() => {
    const formatted = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  });

  readonly selectedVenueCourts = computed(() => this.selectedVenue()?.courts ?? []);
  readonly activeCourtCount = computed(() => this.selectedVenueCourts().filter(court => court.active).length);
  readonly availableCourtCount = computed(() =>
    this.selectedVenueCourts().filter(court => this.normalizedCourtStatus(court) === 'AVAILABLE').length
  );
  readonly inUseCourtCount = computed(() => this.selectedVenueCourts().filter(court =>
    ['HELD', 'OCCUPIED'].includes(this.normalizedCourtStatus(court))
  ).length);
  readonly maintenanceCourtCount = computed(() => this.selectedVenueCourts().filter(court =>
    this.normalizedCourtStatus(court) === 'MAINTENANCE'
  ).length);
  readonly utilizationRate = computed(() => this.activeCourtCount()
    ? Math.round((this.inUseCourtCount() / this.activeCourtCount()) * 100)
    : 0
  );

  readonly dailyRevenue = computed(() => this.dailyRevenueReport()?.currentPeriod.totalRevenue ?? 0);
  readonly dailyBookingCount = computed(() => this.dailyRevenueReport()?.currentPeriod.bookingCount ?? 0);
  readonly dailyPaidBookingCount = computed(() => this.dailyRevenueReport()?.currentPeriod.paidBookingCount ?? 0);
  readonly dailyPaymentRate = computed(() => this.dailyBookingCount()
    ? Math.round((this.dailyPaidBookingCount() / this.dailyBookingCount()) * 100)
    : 0
  );
  readonly dailyPreviousRevenue = computed(() => this.dailyRevenueReport()?.previousPeriod.totalRevenue ?? 0);
  readonly dailyRevenueChange = computed(() => {
    const report = this.dailyRevenueReport();
    if (!report) return 0;
    if (!report.previousPeriod.totalRevenue) return report.currentPeriod.totalRevenue ? 100 : 0;
    return report.revenueChangePercentage ?? 0;
  });
  readonly dailyRevenueByHour = computed(() => {
    const apiPoints = this.dailyRevenueReport()?.hourlyRevenue ?? [];
    const apiTotal = apiPoints.reduce((total, point) => total + point.revenue, 0);
    if (apiTotal > 0 || this.dailyRevenue() === 0) {
      return new Map(apiPoints.map(point => [point.hour, point.revenue]));
    }

    const fallback = new Map<number, number>();
    for (const booking of this.dailyRevenueBookings()) {
      const succeededRevenue = booking.payments
        .filter(payment => payment.status === 'SUCCEEDED')
        .reduce((total, payment) => total + payment.amount, 0);
      if (!succeededRevenue) continue;
      const hour = Number.parseInt(booking.startTime.slice(0, 2), 10);
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
        fallback.set(hour, (fallback.get(hour) ?? 0) + succeededRevenue);
      }
    }
    return fallback;
  });
  readonly dailyRevenueChartMaximum = computed(() => this.niceRevenueMaximum(
    Math.max(this.dailyRevenue(), [...this.dailyRevenueByHour().values()].reduce((total, value) => total + value, 0))
  ));
  readonly dailyRevenueYAxisTicks = computed(() => Array.from({ length: 6 }, (_, index) => ({
    value: this.dailyRevenueChartMaximum() * (5 - index) / 5,
    y: 24 + index * 27.2
  })));
  readonly dailyRevenueChartPoints = computed<readonly DailyRevenueChartPoint[]>(() => {
    const revenueByHour = this.dailyRevenueByHour();
    let cumulativeRevenue = 0;
    const values = Array.from({ length: 24 }, (_, hour) => {
      const revenue = revenueByHour.get(hour) ?? 0;
      cumulativeRevenue += revenue;
      return { hour, revenue, cumulativeRevenue };
    });
    values.push({ hour: 24, revenue: 0, cumulativeRevenue });
    const maximum = this.dailyRevenueChartMaximum();
    return values.map(point => ({
      ...point,
      x: this.revenueHourX(point.hour),
      y: 160 - (point.cumulativeRevenue / maximum) * 136
    }));
  });
  readonly dailyRevenueLinePath = computed(() => this.smoothRevenuePath(this.dailyRevenueChartPoints()));
  readonly dailyRevenueAreaPath = computed(() => {
    const points = this.dailyRevenueChartPoints();
    if (!points.length) return '';
    return `${this.dailyRevenueLinePath()} L ${points.at(-1)!.x} 160 L ${points[0].x} 160 Z`;
  });
  readonly dailyRevenueLastPoint = computed(() => this.dailyRevenueChartPoints().at(-1));
  readonly monthlyRevenue = computed(() => this.monthlyRevenueReport()?.currentPeriod.totalRevenue ?? 0);
  readonly revenueChange = computed(() => this.monthlyRevenueReport()?.revenueChangePercentage ?? 0);
  readonly newCustomerCount = computed(() => this.customerMetricsReport()?.currentPeriod.newCustomers ?? 0);
  readonly previousNewCustomerCount = computed(() => this.customerMetricsReport()?.previousPeriod.newCustomers ?? 0);
  readonly newCustomerChange = computed(() => this.changePercentage(
    this.newCustomerCount(), this.previousNewCustomerCount()
  ));
  readonly returningCustomerRate = computed(() =>
    Math.round(this.customerMetricsReport()?.currentPeriod.returningRate ?? 0)
  );
  readonly previousReturningCustomerRate = computed(() =>
    Math.round(this.customerMetricsReport()?.previousPeriod.returningRate ?? 0)
  );
  readonly returningCustomerChange = computed(() =>
    this.returningCustomerRate() - this.previousReturningCustomerRate()
  );
  readonly liveCourts = computed(() => this.selectedVenueCourts());
  readonly hasCourtCarousel = computed(() => this.liveCourts().length > 5);

  readonly dashboardMetrics = computed<readonly DashboardMetric[]>(() => {
    const report = this.monthlyRevenueReport();
    const bookingChange = report?.bookingCountChangePercentage ?? 0;
    const bookingCount = report?.currentPeriod.bookingCount ?? 0;
    return [
      {
        label: 'Doanh thu tháng hiện tại', value: this.money(this.monthlyRevenue()), icon: 'trending-up',
        detail: `${this.signedPercentage(this.revenueChange())} so với tháng trước`, negative: this.revenueChange() < 0
      },
      {
        label: 'Tổng lượt đặt', value: String(bookingCount), icon: 'calendar-check',
        detail: `${this.signedPercentage(bookingChange)} so với tháng trước`, negative: bookingChange < 0
      },
      {
        label: 'Khách hàng mới', value: String(this.newCustomerCount()), icon: 'user-round',
        detail: `${this.signedPercentage(this.newCustomerChange())} so với tháng trước`,
        negative: this.newCustomerChange() < 0
      },
      {
        label: 'Tỷ lệ khách quay lại', value: `${this.returningCustomerRate()}%`, icon: 'rotate-ccw',
        detail: `${this.returningCustomerChange() > 0 ? '+' : ''}${this.returningCustomerChange()}% so với tháng trước`,
        negative: this.returningCustomerChange() < 0
      }
    ];
  });

  constructor() {
    this.loadApplications();
    this.startCourtAvailabilityPolling();
  }

  loadApplications(): void {
    if (this.applicationLoading()) return;
    this.applicationLoading.set(true);
    this.applicationError.set(null);

    this.getMyApplications.execute({ page: 0, size: 20 }).pipe(
      take(1),
      finalize(() => this.applicationLoading.set(false))
    ).subscribe({
      next: response => {
        const applications = [...(response.result ?? [])].sort((left, right) =>
          this.timestamp(right.createdAt) - this.timestamp(left.createdAt)
        );
        this.applications.set(applications);
        if (applications.some(application => application.status === OwnerApplicationStatus.APPROVED)) {
          this.loadVenues();
        } else {
          this.venues.set([]);
          this.selectedVenueId.set(null);
          this.venueError.set(null);
        }
      },
      error: () => {
        this.applications.set([]);
        this.venues.set([]);
        this.selectedVenueId.set(null);
        this.applicationError.set('Không thể tải tiến trình lúc này. Vui lòng thử lại.');
      }
    });
  }

  retryVenues(): void {
    this.loadVenues();
  }

  retryBusinessSnapshot(): void {
    this.loadBusinessSnapshot();
    this.loadDailyRevenue();
  }

  selectVenue(event: Event): void {
    const venueId = (event.target as HTMLSelectElement).value;
    if (!venueId || venueId === this.selectedVenueId() || this.businessLoading() || this.dailyRevenueLoading()) return;
    this.selectedVenueId.set(venueId);
    this.resetCourtCarousel();
    this.dailyRevenueReport.set(null);
    this.dailyRevenueBookings.set([]);
    this.monthlyRevenueReport.set(null);
    this.upcomingBookings.set([]);
    this.liveCourtBookings.set([]);
    this.customerMetricsReport.set(null);
    this.refreshCourtAvailability(venueId);
    this.loadBusinessSnapshot();
    this.loadDailyRevenue();
  }

  selectRevenueDate(event: Event): void {
    this.revenueDateDraft.set((event.target as HTMLInputElement).value);
  }

  applyRevenueDate(): void {
    const date = this.revenueDateDraft();
    if (!date || date > this.maximumRevenueDate || this.dailyRevenueLoading()) return;
    this.appliedRevenueDate.set(date);
    this.dailyRevenueReport.set(null);
    this.dailyRevenueBookings.set([]);
    this.loadDailyRevenue();
  }

  openBookingDetail(bookingId: string): void {
    if (!bookingId) return;
    this.bookingDetailId.set(bookingId);
    this.bookingDetail.set(null);
    this.bookingDetailError.set(null);
    this.loadBookingDetail(bookingId);
  }

  closeBookingDetail(): void {
    this.bookingDetailId.set(null);
    this.bookingDetail.set(null);
    this.bookingDetailError.set(null);
    this.bookingDetailLoading.set(false);
  }

  retryBookingDetail(): void {
    const bookingId = this.bookingDetailId();
    if (bookingId) this.loadBookingDetail(bookingId);
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: this.dailyRevenueReport()?.currency ?? this.monthlyRevenueReport()?.currency ?? 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }

  signedPercentage(value: number | null | undefined): string {
    const normalized = value ?? 0;
    return `${normalized > 0 ? '+' : ''}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(normalized)}%`;
  }

  shortDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
  }

  timeValue(value: string): string {
    return value?.slice(0, 5) ?? '--:--';
  }

  longDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
  }

  revenueHourX(hour: number): number {
    return 62 + (hour / 24) * 956;
  }

  revenueHourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  compactRevenue(value: number): string {
    if (value >= 1_000_000_000) return `${this.compactNumber(value / 1_000_000_000)}Tỷ`;
    if (value >= 1_000_000) return `${this.compactNumber(value / 1_000_000)}Tr`;
    if (value >= 1_000) return `${this.compactNumber(value / 1_000)}K`;
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
  }

  chartMoney(value: number): string {
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)}đ`;
  }

  dateTime(value?: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date(value));
  }

  bookingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã check-in',
      COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
      REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền'
    };
    return labels[status] ?? status;
  }

  bookingSourceLabel(source: OwnerBookingSource): string {
    return { DIRECT: 'Đặt trực tuyến', AI_MATCHMAKING: 'Ghép trận AI', WALK_IN: 'Khách vãng lai' }[source];
  }

  paymentPurposeLabel(purpose: string): string {
    return purpose === 'BOOKING_DEPOSIT' ? 'Tiền cọc' : 'Thanh toán còn lại';
  }

  paymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      SUCCEEDED: 'Thành công', PENDING: 'Đang xử lý', FAILED: 'Thất bại',
      EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy', REFUNDED: 'Đã hoàn tiền'
    };
    return labels[status] ?? status;
  }

  customerInitial(booking: OwnerBooking): string {
    return (booking.walkInCustomerName || booking.bookingCode || 'G').trim().charAt(0).toUpperCase();
  }

  normalizedCourtStatus(court: OwnerVenueCourt): CourtAvailabilityStatus {
    if (!court.active) return 'INACTIVE';
    if (court.availabilityStatus === 'MAINTENANCE') return 'MAINTENANCE';
    if (this.hasCurrentBooking(court.venueCourtId)) return 'OCCUPIED';
    return court.availabilityStatus ?? 'AVAILABLE';
  }

  courtAvailabilityLabel(court: OwnerVenueCourt): string {
    const labels: Record<CourtAvailabilityStatus, string> = {
      AVAILABLE: 'Đang trống', HELD: 'Đang giữ chỗ', OCCUPIED: 'Đang chơi',
      MAINTENANCE: 'Bảo trì', INACTIVE: 'Tạm ngưng'
    };
    return labels[this.normalizedCourtStatus(court)];
  }

  sportLabel(sportType: string): string {
    const labels: Record<string, string> = {
      FOOTBALL: 'Bóng đá', BADMINTON: 'Cầu lông', TENNIS: 'Tennis',
      PICKLEBALL: 'Pickleball', BASKETBALL: 'Bóng rổ', VOLLEYBALL: 'Bóng chuyền'
    };
    return labels[sportType] ?? sportType;
  }

  utilizationGradient(): string {
    const total = Math.max(this.activeCourtCount(), 1);
    const used = (this.inUseCourtCount() / total) * 100;
    const maintenanceEnd = used + (this.maintenanceCourtCount() / total) * 100;
    return `conic-gradient(var(--dashboard-primary-hover) 0 ${used}%, var(--dashboard-warning) ${used}% ${maintenanceEnd}%, var(--dashboard-success) ${maintenanceEnd}% 100%)`;
  }

  scrollLiveCourts(direction: -1 | 1): void {
    const viewport = this.liveCourtsViewport()?.nativeElement;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.82, 160),
      behavior: 'smooth'
    });
  }

  updateCourtNavigation(): void {
    const viewport = this.liveCourtsViewport()?.nativeElement;
    if (!viewport || !this.hasCourtCarousel()) {
      this.canScrollCourtsBackward.set(false);
      this.canScrollCourtsForward.set(false);
      return;
    }
    const boundaryTolerance = 2;
    this.canScrollCourtsBackward.set(viewport.scrollLeft > boundaryTolerance);
    this.canScrollCourtsForward.set(
      viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - boundaryTolerance
    );
  }

  private loadVenues(): void {
    if (this.venueLoading()) return;
    this.venueLoading.set(true);
    this.venueError.set(null);
    this.venueCoverUrls.set({});
    this.getMyVenues.execute().pipe(
      take(1),
      finalize(() => this.venueLoading.set(false))
    ).subscribe({
      next: venues => {
        const loadedVenues = venues ?? [];
        this.venues.set(loadedVenues);
        const currentVenueId = this.selectedVenueId();
        const nextVenueId = loadedVenues.some(venue => venue.venueId === currentVenueId)
          ? currentVenueId
          : loadedVenues[0]?.venueId ?? null;
        this.selectedVenueId.set(nextVenueId);
        this.resetCourtCarousel();
        this.resolveVenueCoverUrls(loadedVenues);
        if (nextVenueId) this.refreshCourtAvailability(nextVenueId);
      },
      error: () => {
        this.venues.set([]);
        this.selectedVenueId.set(null);
        this.venueCoverUrls.set({});
        this.venueError.set('Venue Service chưa trả về được danh mục cơ sở.');
      },
      complete: () => {
        if (this.venues().length) {
          this.loadBusinessSnapshot();
          this.loadDailyRevenue();
        }
      }
    });
  }

  private startCourtAvailabilityPolling(): void {
    timer(COURT_AVAILABILITY_POLL_INTERVAL_MS, COURT_AVAILABILITY_POLL_INTERVAL_MS).pipe(
      filter(() => Boolean(this.selectedVenueId())),
      exhaustMap(() => {
        const venueId = this.selectedVenueId();
        if (!venueId) return EMPTY;
        return this.loadLiveCourtState(venueId);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ venueId, courts, bookings }) => this.applyLiveCourtState(venueId, courts, bookings));
  }

  private refreshCourtAvailability(venueId: string): void {
    this.loadLiveCourtState(venueId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      catchError(() => EMPTY)
    ).subscribe(({ courts, bookings }) => this.applyLiveCourtState(venueId, courts, bookings));
  }

  private loadLiveCourtState(venueId: string): Observable<{
    venueId: string;
    courts: OwnerVenueCourt[];
    bookings: OwnerBooking[];
  }> {
    const today = this.today();
    return forkJoin({
      courts: this.manageCourts.list(venueId).pipe(take(1)),
      bookings: this.loadBookingsForRange(venueId, today, today).pipe(catchError(() => of([])))
    }).pipe(map(({ courts, bookings }) => ({ venueId, courts, bookings })));
  }

  private applyLiveCourtState(venueId: string | null, courts: OwnerVenueCourt[], bookings: OwnerBooking[]): void {
    if (!venueId || venueId !== this.selectedVenueId()) return;
    this.venues.update(venues => venues.map(venue => venue.venueId === venueId
      ? { ...venue, courts }
      : venue
    ));
    this.liveCourtBookings.set(bookings.filter(booking =>
      booking.venueId === venueId
      && ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)
    ));
    queueMicrotask(() => this.updateCourtNavigation());
  }

  private resetCourtCarousel(): void {
    this.canScrollCourtsBackward.set(false);
    this.canScrollCourtsForward.set(this.hasCourtCarousel());
    const viewport = this.liveCourtsViewport()?.nativeElement;
    if (viewport) viewport.scrollLeft = 0;
  }

  private loadBusinessSnapshot(): void {
    const venueId = this.selectedVenueId();
    if (this.businessLoading() || !venueId) return;
    this.businessLoading.set(true);
    this.businessError.set(null);
    const currentMonth = this.monthRange(0);

    forkJoin({
      monthlyRevenue: this.getRevenue.execute({
        venueId, fromDate: currentMonth.fromDate, toDate: currentMonth.toDate
      }).pipe(
        catchError(() => of(null))
      ),
      upcoming: this.loadBookingsForRange(
        venueId, this.today(), this.daysFromNow(6)
      ).pipe(catchError(() => of(null))),
      customerMetrics: this.getCustomerMetrics.execute({
        venueId, month: currentMonth.fromDate.slice(0, 7)
      }).pipe(catchError(() => of(null)))
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.businessLoading.set(false))
    ).subscribe(({ monthlyRevenue, upcoming, customerMetrics }) => {
      this.monthlyRevenueReport.set(monthlyRevenue);
      this.upcomingBookings.set((upcoming ?? [])
        .filter(booking => booking.venueId === venueId)
        .filter(booking => ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status))
        .sort((left, right) => `${left.playDate}${left.startTime}`.localeCompare(`${right.playDate}${right.startTime}`)));
      this.customerMetricsReport.set(customerMetrics);
      if (!monthlyRevenue && !upcoming && !customerMetrics) {
        this.businessError.set('Chưa thể tải dữ liệu vận hành lúc này.');
      }
    });
  }

  private loadDailyRevenue(): void {
    const venueId = this.selectedVenueId();
    const date = this.appliedRevenueDate();
    if (!venueId || !date || this.dailyRevenueLoading()) return;
    this.dailyRevenueLoading.set(true);
    this.dailyRevenueError.set(null);
    forkJoin({
      report: this.getRevenue.execute({ venueId, fromDate: date, toDate: date }),
      bookings: this.loadBookingsForRange(venueId, date, date).pipe(catchError(() => of([])))
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.dailyRevenueLoading.set(false))
    ).subscribe({
      next: ({ report, bookings }) => {
        this.dailyRevenueReport.set(report);
        this.dailyRevenueBookings.set(bookings);
      },
      error: () => {
        this.dailyRevenueReport.set(null);
        this.dailyRevenueBookings.set([]);
        this.dailyRevenueError.set('Chưa thể tải doanh thu của ngày đã chọn.');
      }
    });
  }

  private loadBookingDetail(bookingId: string): void {
    if (this.bookingDetailLoading()) return;
    this.bookingDetailLoading.set(true);
    this.bookingDetailError.set(null);
    this.manageBookings.detail(bookingId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.bookingDetailLoading.set(false))
    ).subscribe({
      next: booking => {
        if (this.bookingDetailId() === bookingId) this.bookingDetail.set(booking);
      },
      error: () => {
        if (this.bookingDetailId() === bookingId) {
          this.bookingDetailError.set('Không thể tải chi tiết booking. Vui lòng thử lại.');
        }
      }
    });
  }

  private loadBookingsForRange(venueId: string, fromDate: string, toDate: string): Observable<OwnerBooking[]> {
    const requestPage = (page: number) => this.manageBookings.list({
      venueId, fromDate, toDate, page, size: 20
    });
    return requestPage(0).pipe(
      expand(result => result.page + 1 < result.pages ? requestPage(result.page + 1) : EMPTY),
      reduce((bookings, result) => [...bookings, ...result.items], [] as OwnerBooking[])
    );
  }

  private resolveVenueCoverUrls(venues: readonly OwnerVenueOverview[]): void {
    venues.forEach(venue => {
      const key = venue.imageUrls?.[0]?.trim();
      if (!key) return;

      this.getFileUrl.execute(key).pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of(null))
      ).subscribe(url => {
        if (!url || !this.isAbsoluteFileUrl(url)) return;
        const currentKey = this.venues()
          .find(currentVenue => currentVenue.venueId === venue.venueId)
          ?.imageUrls?.[0]?.trim();
        if (currentKey !== key) return;
        this.venueCoverUrls.update(urls => ({ ...urls, [venue.venueId]: url }));
      });
    });
  }

  private isAbsoluteFileUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private today(): string {
    return this.localDate(new Date());
  }

  private monthRange(offset: number): { fromDate: string; toDate: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { fromDate: this.localDate(start), toDate: this.localDate(end) };
  }

  private daysFromNow(days: number): string {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return this.localDate(value);
  }

  private localDate(value: Date): string {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  private hasCurrentBooking(courtId: string): boolean {
    const today = this.today();
    const now = this.currentMinutes();
    return this.liveCourtBookings().some(booking =>
      booking.venueCourtId === courtId
      && booking.playDate === today
      && ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)
      && this.timeMinutes(booking.startTime) <= now
      && this.timeMinutes(booking.endTime) > now
    );
  }

  private currentMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  private timeMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  private changePercentage(current: number, previous: number): number {
    if (!previous) return current ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private niceRevenueMaximum(value: number): number {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const ceiling = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return ceiling * magnitude;
  }

  private smoothRevenuePath(points: readonly DailyRevenueChartPoint[]): string {
    if (!points.length) return '';
    return points.slice(1).reduce((path, point, index) => {
      const previous = points[index];
      const middleX = (previous.x + point.x) / 2;
      return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
    }, `M ${points[0].x} ${points[0].y}`);
  }

  private compactNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
  }

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
