import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { catchError, finalize, forkJoin, of, take } from 'rxjs';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerRevenueReport } from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { MetricRailComponent } from '@shared/components/ui/metric-rail/metric-rail.component';
import { MetricRailItem } from '@shared/components/ui/metric-rail/metric-rail.models';
import { WeatherWidgetComponent } from '@shared/components/ui/weather-widget/weather-widget.component';
import { WeatherInfo } from '@shared/components/ui/weather-widget/weather-widget.models';
import { OwnerApplicationProgressComponent } from '../dashboard/owner-application-progress/owner-application-progress.component';
import { OwnerFeatureGridComponent } from './owner-feature-grid/owner-feature-grid.component';
import { OwnerVenueOverviewComponent } from './owner-venue-overview/owner-venue-overview.component';
import { OWNER_WORKSPACE_FEATURES } from './venue-owner-dashboard.models';

interface OwnerQuickAction {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-venue-owner-dashboard',
  standalone: true,
  imports: [
    RouterModule,
    LucideIconComponent,
    MetricRailComponent,
    WeatherWidgetComponent,
    OwnerApplicationProgressComponent,
    OwnerFeatureGridComponent,
    OwnerVenueOverviewComponent
  ],
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
  readonly features = OWNER_WORKSPACE_FEATURES;
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
  readonly primaryVenueCoverUrl = computed(() => {
    const venueId = this.venues()[0]?.venueId;
    return venueId ? this.venueCoverUrls()[venueId] ?? null : null;
  });
  readonly venueDataUnavailable = computed(() => this.venueLoading() || Boolean(this.venueError()));
  readonly operationsEnabled = computed(() =>
    this.applicationApproved() && !this.venueDataUnavailable() && this.venues().length > 0
  );
  readonly activeVenueCount = computed(() => this.venues().filter(venue => venue.active).length);
  readonly totalCourtCount = computed(() =>
    this.venues().reduce((total, venue) => total + (venue.courts?.length ?? 0), 0)
  );
  readonly activeCourtCount = computed(() =>
    this.venues().reduce(
      (total, venue) => total + (venue.courts?.filter(court => court.active).length ?? 0),
      0
    )
  );
  readonly availableCourtCount = computed(() => this.venues().reduce(
    (total, venue) => total + (venue.courts?.filter(court => court.availabilityStatus === 'AVAILABLE').length ?? 0),
    0
  ));
  readonly occupiedCourtCount = computed(() => Math.max(this.activeCourtCount() - this.availableCourtCount(), 0));
  readonly utilizationRate = computed(() => this.activeCourtCount()
    ? Math.round((this.occupiedCourtCount() / this.activeCourtCount()) * 100)
    : 0
  );
  readonly maxDailyRevenue = computed(() => Math.max(
    0, ...(this.revenueReport()?.dailyRevenue.map(point => point.revenue) ?? [])
  ));
  readonly totalReviewCount = computed(() =>
    this.venues().reduce((total, venue) => total + (venue.totalReviews ?? 0), 0)
  );
  readonly averageRating = computed<number | null>(() => {
    const reviewCount = this.totalReviewCount();
    if (!reviewCount) return null;
    const weightedTotal = this.venues().reduce(
      (total, venue) => total + (venue.averageRating ?? 0) * (venue.totalReviews ?? 0),
      0
    );
    return Math.round((weightedTotal / reviewCount) * 10) / 10;
  });

  readonly metricItems = computed<readonly MetricRailItem[]>(() => {
    const unavailableValue = this.venueDataUnavailable() ? '—' : null;
    const inactiveVenueCount = this.venues().length - this.activeVenueCount();
    const inactiveCourtCount = this.totalCourtCount() - this.activeCourtCount();
    return [
      {
        label: 'Cơ sở quản lý',
        value: unavailableValue ?? this.venues().length,
        icon: 'land-plot',
        description: unavailableValue
          ? 'Chưa thể xác minh danh mục'
          : `${this.activeVenueCount()} đang hoạt động`
      },
      {
        label: 'Tổng sân thi đấu',
        value: unavailableValue ?? this.totalCourtCount(),
        icon: 'layout-grid',
        description: unavailableValue
          ? 'Chưa thể tổng hợp dữ liệu'
          : `${this.venues().length} cơ sở${inactiveVenueCount > 0 ? ` · ${inactiveVenueCount} chưa kích hoạt` : ''}`
      },
      {
        label: 'Sân đang hoạt động',
        value: unavailableValue ?? this.activeCourtCount(),
        icon: 'activity',
        description: unavailableValue
          ? 'Chưa thể tổng hợp dữ liệu'
          : inactiveCourtCount > 0 ? `${inactiveCourtCount} sân tạm ngưng` : 'Sẵn sàng phục vụ'
      },
      {
        label: 'Điểm đánh giá',
        value: unavailableValue ?? this.averageRating() ?? 'Chưa có',
        icon: 'star',
        description: unavailableValue
          ? 'Chưa thể tổng hợp dữ liệu'
          : this.totalReviewCount() > 0
            ? `${this.totalReviewCount()} lượt đánh giá`
            : 'Chưa có lượt đánh giá'
      }
    ];
  });

  readonly heroDescription = computed(() => {
    if (this.applicationApproved()) {
      return 'Theo dõi toàn bộ cơ sở, sân thi đấu và các thông tin vận hành quan trọng trong một không gian thống nhất.';
    }
    if (this.latestApplication()) {
      return 'Theo dõi tiến trình xét duyệt hồ sơ. Các công cụ quản lý cơ sở sẽ được mở khi hồ sơ được phê duyệt.';
    }
    return 'Bắt đầu bằng hồ sơ đối tác để GOAT Sports xác minh và khởi tạo cơ sở cho bạn.';
  });

  readonly quickAction = computed<OwnerQuickAction>(() => {
    if (!this.applicationApproved() || this.venueDataUnavailable() || !this.venues().length) {
      return {
        label: this.latestApplication() ? 'Xem hồ sơ' : 'Đăng ký chủ sân',
        route: this.applicationUrl,
        icon: 'clipboard-check'
      };
    }
    if (!this.activeVenueCount()) {
      return { label: 'Kích hoạt cơ sở', route: '/admin/venues', icon: 'land-plot' };
    }
    if (!this.totalCourtCount()) {
      return { label: 'Tạo sân đầu tiên', route: '/admin/courts', icon: 'activity' };
    }
    return { label: 'Mở check-in', route: '/admin/check-in', icon: 'shield-check' };
  });

  readonly toolLockReason = computed(() => {
    if (!this.applicationApproved()) return 'Chờ duyệt hồ sơ để mở khóa vận hành';
    if (this.venueLoading()) return 'Đang xác minh danh mục cơ sở';
    if (this.venueError()) return 'Chưa thể xác minh quyền quản lý cơ sở';
    return 'Chưa có cơ sở được liên kết với tài khoản';
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

  retryBusinessSnapshot(): void {
    this.loadBusinessSnapshot();
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: this.revenueReport()?.currency ?? 'VND', maximumFractionDigits: 0
    }).format(value);
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

  revenueBarHeight(value: number): number {
    const maximum = this.maxDailyRevenue();
    return maximum && value ? Math.max(8, Math.round((value / maximum) * 100)) : 0;
  }

  private loadBusinessSnapshot(): void {
    if (this.businessLoading() || !this.venues().length) return;
    this.businessLoading.set(true);
    this.businessError.set(null);

    forkJoin({
      revenue: this.getRevenue.execute({ fromDate: this.monthStart(), toDate: this.today() }).pipe(
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
        .slice(0, 6));
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
