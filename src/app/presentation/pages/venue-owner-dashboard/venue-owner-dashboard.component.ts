import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize, take } from 'rxjs';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { GetOwnerVenueOverviewUseCase } from '@application/usecase/venue-owner-dashboard/get-owner-venue-overview.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { MetricRailComponent } from '@shared/components/ui/metric-rail/metric-rail.component';
import { MetricRailItem } from '@shared/components/ui/metric-rail/metric-rail.models';
import { WeatherWidgetComponent } from '@shared/components/ui/weather-widget/weather-widget.component';
import { WeatherInfo } from '@shared/components/ui/weather-widget/weather-widget.models';
import { OwnerApplicationProgressComponent } from '../dashboard/owner-application-progress/owner-application-progress.component';
import { OwnerFeatureGridComponent } from './owner-feature-grid/owner-feature-grid.component';
import { OwnerVenueOverviewComponent } from './owner-venue-overview/owner-venue-overview.component';
import { OWNER_WORKSPACE_FEATURES } from './venue-owner-dashboard.models';

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
  private readonly getVenueOverview = inject(GetOwnerVenueOverviewUseCase);

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
  readonly venue = signal<OwnerVenueOverview | null>(null);
  readonly venueLoading = signal(false);
  readonly venueError = signal<string | null>(null);

  readonly latestApplication = computed(() => this.applications()[0] ?? null);
  readonly approvedApplication = computed(() =>
    this.applications().find(application =>
      application.status === OwnerApplicationStatus.APPROVED && Boolean(application.venueId)
    ) ?? null
  );
  readonly applicationApproved = computed(() => Boolean(this.approvedApplication()));
  readonly displayName = computed(() => this.ownerName().trim() || 'Chủ sân');
  readonly totalCourtCount = computed(() => this.venue()?.courts?.length ?? 0);
  readonly activeCourtCount = computed(() => this.venue()?.courts?.filter(court => court.active).length ?? 0);
  readonly amenityCount = computed(() => this.venue()?.amenities?.length ?? 0);
  readonly ratingValue = computed(() => this.venue()?.averageRating ?? 'Chưa có');
  readonly ratingDescription = computed(() => {
    const totalReviews = this.venue()?.totalReviews ?? 0;
    return totalReviews > 0 ? `${totalReviews} lượt đánh giá` : 'Chưa có lượt đánh giá';
  });
  readonly metricItems = computed<readonly MetricRailItem[]>(() => [
    {
      label: 'Tổng sân thi đấu',
      value: this.venueLoading() ? '—' : this.totalCourtCount(),
      icon: 'layout-grid',
      description: 'Số sân thuộc cơ sở'
    },
    {
      label: 'Sân đang hoạt động',
      value: this.venueLoading() ? '—' : this.activeCourtCount(),
      icon: 'activity',
      description: 'Sẵn sàng phục vụ'
    },
    {
      label: 'Điểm đánh giá',
      value: this.venueLoading() ? '—' : this.ratingValue(),
      icon: 'star',
      description: this.ratingDescription()
    },
    {
      label: 'Tiện ích',
      value: this.venueLoading() ? '—' : this.amenityCount(),
      icon: 'sparkles',
      description: 'Tiện ích đã công bố'
    }
  ]);

  readonly heroDescription = computed(() => {
    if (this.applicationApproved()) {
      return 'Theo dõi cơ sở, sân thi đấu và các thông tin vận hành quan trọng trong một không gian thống nhất.';
    }
    if (this.latestApplication()) {
      return 'Theo dõi tiến trình xét duyệt hồ sơ. Các công cụ quản lý cơ sở sẽ được mở khi hồ sơ được phê duyệt.';
    }
    return 'Bắt đầu bằng hồ sơ đối tác để GOAT Sports xác minh và khởi tạo cơ sở cho bạn.';
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
        const approved = applications.find(application =>
          application.status === OwnerApplicationStatus.APPROVED && Boolean(application.venueId)
        );
        if (approved?.venueId) this.loadVenue(approved.venueId);
      },
      error: () => {
        this.applications.set([]);
        this.applicationError.set('Không thể tải tiến trình lúc này. Vui lòng thử lại.');
      }
    });
  }

  retryVenue(): void {
    const venueId = this.approvedApplication()?.venueId;
    if (venueId) this.loadVenue(venueId);
  }

  private loadVenue(venueId: string): void {
    if (this.venueLoading()) return;
    this.venueLoading.set(true);
    this.venueError.set(null);
    this.getVenueOverview.execute(venueId).pipe(
      take(1),
      finalize(() => this.venueLoading.set(false))
    ).subscribe({
      next: venue => this.venue.set(venue),
      error: () => {
        this.venue.set(null);
        this.venueError.set('Venue Service chưa trả về được thông tin cơ sở.');
      }
    });
  }

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
