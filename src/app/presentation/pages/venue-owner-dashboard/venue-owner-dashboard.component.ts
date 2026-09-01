import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { catchError, finalize, forkJoin, of, take } from 'rxjs';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerBooking, OwnerBookingSource } from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerRevenueReport } from '@application/dto/owner-revenue/owner-revenue.dto';
import {
  CourtAvailabilityStatus,
  OwnerVenueCourt,
  OwnerVenueOverview
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { WeatherInfo } from '@shared/components/ui/weather-widget/weather-widget.models';
import { OwnerApplicationProgressComponent } from '../dashboard/owner-application-progress/owner-application-progress.component';

interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
  icon: string;
  negative?: boolean;
}

interface RevenueChartPoint {
  date: string;
  revenue: number;
  x: number;
  y: number;
}

interface OperationAlert {
  level: 'danger' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  detail: string;
}

@Component({
  selector: 'app-venue-owner-dashboard',
  standalone: true,
  imports: [RouterModule, LucideIconComponent, OwnerApplicationProgressComponent],
  templateUrl: './venue-owner-dashboard.component.html',
  styleUrl: './venue-owner-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerDashboardComponent {
  private readonly getMyApplications = inject(GetMyOwnerApplicationsUseCase);
  private readonly getMyVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
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

  readonly applications = signal<OwnerApplication[]>([]);
  readonly applicationLoading = signal(false);
  readonly applicationError = signal<string | null>(null);
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly venueLoading = signal(false);
  readonly venueError = signal<string | null>(null);
  readonly businessLoading = signal(false);
  readonly businessError = signal<string | null>(null);
  readonly revenueReport = signal<OwnerRevenueReport | null>(null);
  readonly upcomingBookings = signal<OwnerBooking[]>([]);
  readonly venueCoverUrls = signal<Readonly<Record<string, string>>>({});

  readonly latestApplication = computed(() => this.applications()[0] ?? null);
  readonly approvedApplication = computed(() =>
    this.applications().find(application => application.status === OwnerApplicationStatus.APPROVED) ?? null
  );
  readonly applicationApproved = computed(() => Boolean(this.approvedApplication()));
  readonly displayName = computed(() => this.ownerName().trim() || 'Chủ sân');
  readonly primaryVenue = computed(() => this.venues()[0] ?? null);
  readonly primaryVenueCoverUrl = computed(() => {
    const venueId = this.primaryVenue()?.venueId;
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

  readonly allCourts = computed(() => this.venues().flatMap(venue => venue.courts ?? []));
  readonly activeCourtCount = computed(() => this.allCourts().filter(court => court.active).length);
  readonly availableCourtCount = computed(() =>
    this.allCourts().filter(court => this.normalizedCourtStatus(court) === 'AVAILABLE').length
  );
  readonly inUseCourtCount = computed(() => this.allCourts().filter(court =>
    ['HELD', 'OCCUPIED'].includes(this.normalizedCourtStatus(court))
  ).length);
  readonly maintenanceCourtCount = computed(() => this.allCourts().filter(court =>
    this.normalizedCourtStatus(court) === 'MAINTENANCE'
  ).length);
  readonly utilizationRate = computed(() => this.activeCourtCount()
    ? Math.round((this.inUseCourtCount() / this.activeCourtCount()) * 100)
    : 0
  );

  readonly monthlyRevenue = computed(() => this.revenueReport()?.currentPeriod.totalRevenue ?? 0);
  readonly revenueChange = computed(() => this.revenueReport()?.revenueChangePercentage ?? 0);
  readonly revenueChartPoints = computed<readonly RevenueChartPoint[]>(() => {
    const values = this.revenueReport()?.dailyRevenue ?? [];
    if (!values.length) return [];
    const maximum = Math.max(1, ...values.map(point => point.revenue));
    return values.map((point, index) => ({
      ...point,
      x: values.length === 1 ? 12 : 12 + (index / (values.length - 1)) * 616,
      y: 176 - (point.revenue / maximum) * 150
    }));
  });
  readonly revenueLinePoints = computed(() =>
    this.revenueChartPoints().map(point => `${point.x},${point.y}`).join(' ')
  );
  readonly revenueAreaPath = computed(() => {
    const points = this.revenueChartPoints();
    if (!points.length) return '';
    return `M ${points[0].x} 176 L ${points.map(point => `${point.x} ${point.y}`).join(' L ')} L ${points.at(-1)!.x} 176 Z`;
  });
  readonly revenueAxisPoints = computed(() => this.revenueChartPoints().filter(
    (_, index, points) => this.showRevenueAxisLabel(index, points.length)
  ));
  readonly liveCourts = computed(() => this.allCourts().slice(0, 5));

  readonly dashboardMetrics = computed<readonly DashboardMetric[]>(() => {
    const report = this.revenueReport();
    const bookingChange = report?.bookingCountChangePercentage ?? 0;
    const bookingCount = report?.currentPeriod.bookingCount ?? 0;
    const paidBookingCount = report?.currentPeriod.paidBookingCount ?? 0;
    return [
      {
        label: 'Doanh thu tháng', value: this.money(this.monthlyRevenue()), icon: 'trending-up',
        detail: `${this.signedPercentage(this.revenueChange())} so với kỳ trước`, negative: this.revenueChange() < 0
      },
      {
        label: 'Tổng lượt đặt', value: String(bookingCount), icon: 'calendar-check',
        detail: `${this.signedPercentage(bookingChange)} so với kỳ trước`, negative: bookingChange < 0
      },
      {
        label: 'Booking đã thanh toán', value: String(paidBookingCount), icon: 'circle-check',
        detail: bookingCount ? `${Math.round((paidBookingCount / bookingCount) * 100)}% tổng booking` : 'Chưa có booking'
      },
      {
        label: 'Tỷ lệ sử dụng sân', value: `${this.utilizationRate()}%`, icon: 'gauge',
        detail: `${this.availableCourtCount()}/${this.activeCourtCount()} sân đang trống`
      }
    ];
  });

  readonly operationAlerts = computed<readonly OperationAlert[]>(() => {
    const alerts: OperationAlert[] = [];
    const pendingPayment = this.upcomingBookings().filter(booking => booking.status === 'PENDING_PAYMENT').length;
    if (this.maintenanceCourtCount()) alerts.push({
      level: 'warning', icon: 'alert-triangle', title: `${this.maintenanceCourtCount()} sân đang bảo trì`,
      detail: 'Kiểm tra lịch và chủ động điều phối booking.'
    });
    if (pendingPayment) alerts.push({
      level: 'danger', icon: 'alert-circle', title: `${pendingPayment} booking chờ thanh toán`,
      detail: 'Thời gian giữ chỗ đang được đếm ngược.'
    });
    if (this.inUseCourtCount()) alerts.push({
      level: 'info', icon: 'activity', title: `${this.inUseCourtCount()} sân đang được sử dụng`,
      detail: 'Trạng thái được cập nhật theo slot hiện tại.'
    });
    const nextBooking = this.upcomingBookings()[0];
    if (nextBooking && alerts.length < 3) alerts.push({
      level: 'info', icon: 'clock', title: `Lịch gần nhất lúc ${this.timeValue(nextBooking.startTime)}`,
      detail: `${nextBooking.courtName} · ${this.shortDate(nextBooking.playDate)}`
    });
    if (!alerts.length) alerts.push({
      level: 'success', icon: 'circle-check', title: 'Vận hành đang ổn định',
      detail: `${this.availableCourtCount()} sân sẵn sàng nhận booking.`
    });
    return alerts.slice(0, 3);
  });

  constructor() {
    this.loadApplications();
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
          this.venueError.set(null);
        }
      },
      error: () => {
        this.applications.set([]);
        this.venues.set([]);
        this.applicationError.set('Không thể tải tiến trình lúc này. Vui lòng thử lại.');
      }
    });
  }

  retryVenues(): void {
    this.loadVenues();
  }

  retryBusinessSnapshot(): void {
    this.loadBusinessSnapshot();
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: this.revenueReport()?.currency ?? 'VND', maximumFractionDigits: 0
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

  customerInitial(booking: OwnerBooking): string {
    return (booking.walkInCustomerName || booking.bookingCode || 'G').trim().charAt(0).toUpperCase();
  }

  normalizedCourtStatus(court: OwnerVenueCourt): CourtAvailabilityStatus {
    if (!court.active) return 'INACTIVE';
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

  showRevenueAxisLabel(index: number, total: number): boolean {
    if (total <= 6) return true;
    const interval = Math.ceil((total - 1) / 5);
    return index === 0 || index === total - 1 || index % interval === 0;
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
        this.resolveVenueCoverUrls(loadedVenues);
      },
      error: () => {
        this.venues.set([]);
        this.venueCoverUrls.set({});
        this.venueError.set('Venue Service chưa trả về được danh mục cơ sở.');
      },
      complete: () => {
        if (this.venues().length) this.loadBusinessSnapshot();
      }
    });
  }

  private loadBusinessSnapshot(): void {
    if (this.businessLoading() || !this.venues().length) return;
    this.businessLoading.set(true);
    this.businessError.set(null);

    forkJoin({
      revenue: this.getRevenue.execute({ fromDate: this.monthStart(), toDate: this.monthEnd() }).pipe(
        catchError(() => of(null))
      ),
      bookings: this.manageBookings.list({
        fromDate: this.today(), toDate: this.daysFromNow(7), page: 0, size: 12
      }).pipe(catchError(() => of(null)))
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.businessLoading.set(false))
    ).subscribe(({ revenue, bookings }) => {
      this.revenueReport.set(revenue);
      this.upcomingBookings.set((bookings?.items ?? [])
        .filter(booking => ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status))
        .sort((left, right) => `${left.playDate}${left.startTime}`.localeCompare(`${right.playDate}${right.startTime}`))
        .slice(0, 12));
      if (!revenue && !bookings) {
        this.businessError.set('Chưa thể tải dữ liệu doanh thu và booking lúc này.');
      }
    });
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

  private monthStart(): string {
    const now = new Date();
    return this.localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private monthEnd(): string {
    const now = new Date();
    return this.localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
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

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
