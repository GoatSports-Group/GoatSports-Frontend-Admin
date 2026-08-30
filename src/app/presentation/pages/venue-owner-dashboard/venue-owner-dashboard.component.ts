import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize, take } from 'rxjs';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
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

  readonly latestApplication = computed(() => this.applications()[0] ?? null);
  readonly approvedApplication = computed(() =>
    this.applications().find(application => application.status === OwnerApplicationStatus.APPROVED) ?? null
  );
  readonly applicationApproved = computed(() => Boolean(this.approvedApplication()));
  readonly displayName = computed(() => this.ownerName().trim() || 'Chủ sân');
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
    this.getMyVenues.execute().pipe(
      take(1),
      finalize(() => this.venueLoading.set(false))
    ).subscribe({
      next: venues => this.venues.set(venues ?? []),
      error: () => {
        this.venues.set([]);
        this.venueError.set('Venue Service chưa trả về được danh mục cơ sở.');
      }
    });
  }

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
