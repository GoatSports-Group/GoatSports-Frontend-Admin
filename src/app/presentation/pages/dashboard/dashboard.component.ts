import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { UserService } from '@presentation/services/user.service';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { User } from '@application/dto/user/user.dto';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { AuthService } from '@presentation/services/auth.service';

import { MetricCardComponent } from '@shared/components/ui/metric-card/metric-card.component';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { calculateWeeklyTrend } from '@shared/utils/date-trend.utils';
import { parseWeatherCode } from '@shared/utils/weather-parser.utils';
import { getFallbackAvatar } from '@shared/utils/user-display.utils';
import { VenueMapMarker, WeatherInfo } from './dashboard.models';
import {
  buildDistrictBreakdown,
  createCalendarGrid,
  createVenueMapMarker,
  formatVietnameseDate,
  formatVietnameseMonthYear
} from './dashboard.utils';
import { DashboardMapService } from './dashboard-map.service';

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MetricCardComponent,
    LucideIconComponent,
    DragDropModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  providers: [DashboardMapService]
})
export class DashboardOverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  private userService = inject(UserService);
  private getAllApplicationsUseCase = inject(GetAllOwnerApplicationsUseCase);
  private authService = inject(AuthService);
  private dashboardMap = inject(DashboardMapService);

  currentDate = new Date();
  adminName = 'Quản Trị Viên';
  readonly getFallbackAvatar = getFallbackAvatar;

  get formattedDateVi(): string {
    return formatVietnameseDate(this.currentDate);
  }

  get formattedMonthYearVi(): string {
    return formatVietnameseMonthYear(this.currentDate);
  }

  // Signals State
  loading = signal(false);
  totalUsers = signal(0);
  pendingApps = signal(0);
  approvedApps = signal(0);
  rejectedApps = signal(0);

  // Trend Signals
  totalUsersTrend = signal<string>('0%');
  isTotalUsersTrendPositive = signal<boolean>(true);
  pendingAppsTrend = signal<string>('0%');
  isPendingAppsTrendPositive = signal<boolean>(true);
  approvedAppsTrend = signal<string>('0%');
  isApprovedAppsTrendPositive = signal<boolean>(true);
  rejectedAppsTrend = signal<string>('0%');
  isRejectedAppsTrendPositive = signal<boolean>(true);

  // Computed Rates
  approvalRate = computed(() => {
    const total = this.approvedApps() + this.rejectedApps() + this.pendingApps();
    if (total === 0) return 100;
    return Math.round((this.approvedApps() / total) * 100);
  });

  metricCards = [
    {
      id: 'users',
      title: 'Tổng người dùng',
      value: this.totalUsers,
      icon: 'users',
      trendText: this.totalUsersTrend,
      isPositiveTrend: this.isTotalUsersTrendPositive,
      description: 'Tài khoản người chơi & quản lý',
      colorScheme: 'emerald' as const
    },
    {
      id: 'pending',
      title: 'Đơn chờ duyệt',
      value: this.pendingApps,
      icon: 'clock',
      trendText: this.pendingAppsTrend,
      isPositiveTrend: this.isPendingAppsTrendPositive,
      description: 'Yêu cầu xét duyệt',
      colorScheme: 'amber' as const
    },
    {
      id: 'approved',
      title: 'Sân đang hoạt động',
      value: this.approvedApps,
      icon: 'activity',
      trendText: this.approvedAppsTrend,
      isPositiveTrend: this.isApprovedAppsTrendPositive,
      description: 'Cơ sở đã được xác minh',
      colorScheme: 'cyan' as const
    },
    {
      id: 'rejected',
      title: 'Hồ sơ đã từ chối',
      value: this.rejectedApps,
      icon: 'ban',
      trendText: this.rejectedAppsTrend,
      isPositiveTrend: this.isRejectedAppsTrendPositive,
      description: 'Không đủ điều kiện kinh doanh',
      colorScheme: 'rose' as const
    }
  ];

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.metricCards, event.previousIndex, event.currentIndex);
  }

  recentUsers = signal<User[]>([]);
  approvedVenues = signal<OwnerApplication[]>([]);
  upcomingSurveys = signal<OwnerApplication[]>([]);

  // Owner Application Map State
  mapMarkers = signal<VenueMapMarker[]>([]);
  applicationDistricts = signal<string[]>([]);
  unlocatedVenueCount = signal(0);
  selectedMapStatus = signal<OwnerApplicationStatus | null>(null);

  filteredMapMarkers = computed(() => {
    const status = this.selectedMapStatus();
    return status
      ? this.mapMarkers().filter(marker => marker.status === status)
      : this.mapMarkers();
  });

  districtBreakdown = computed(() => {
    return buildDistrictBreakdown(this.applicationDistricts());
  });

  weather = signal<WeatherInfo>({
    temp: 28,
    condition: 'cloudy',
    icon: 'cloud',
    description: 'Nhiều mây ☁️'
  });

  // Calendar State
  calendarDays: number[] = [];
  calendarOffsetCells: null[] = [];
  currentDay = 1;

  readonly OwnerApplicationStatus = OwnerApplicationStatus;

  ngOnInit() {
    this.adminName = this.authService.currentUser?.fullName || 'Quản Trị Viên';
    this.generateCalendar();
    this.loadDashboardData();
    this.fetchWeather();
  }

  loadDashboardData() {
    this.loading.set(true);
    forkJoin({
      users: this.userService.getUsers({ page: 0, size: 1000 }),
      applications: this.getAllApplicationsUseCase.execute({ page: 0, size: 1000 })
    }).subscribe({
      next: ({ users, applications }) => {
        this.totalUsers.set(users.meta.total);
        this.recentUsers.set(users.result.slice(0, 5));

        const pending = applications.result.filter(a => a.status === OwnerApplicationStatus.PENDING);
        const approved = applications.result.filter(a => a.status === OwnerApplicationStatus.APPROVED);
        const rejected = applications.result.filter(a => a.status === OwnerApplicationStatus.REJECTED);

        this.pendingApps.set(pending.length);
        this.approvedApps.set(approved.length);
        this.rejectedApps.set(rejected.length);

        this.approvedVenues.set(approved.slice(0, 4));
        this.upcomingSurveys.set(pending.slice(0, 3));

        // Calculate real-time weekly trends
        const totalUsersTrendRes = calculateWeeklyTrend(users.result, 'createdAt');
        this.totalUsersTrend.set(totalUsersTrendRes.trendText);
        this.isTotalUsersTrendPositive.set(totalUsersTrendRes.isPositive);

        const pendingTrendRes = calculateWeeklyTrend(pending, 'createdAt');
        this.pendingAppsTrend.set(pendingTrendRes.trendText);
        this.isPendingAppsTrendPositive.set(pendingTrendRes.isPositive);

        const approvedTrendRes = calculateWeeklyTrend(approved, 'reviewedAt');
        this.approvedAppsTrend.set(approvedTrendRes.trendText);
        this.isApprovedAppsTrendPositive.set(approvedTrendRes.isPositive);

        const rejectedTrendRes = calculateWeeklyTrend(rejected, 'reviewedAt');
        this.rejectedAppsTrend.set(rejectedTrendRes.trendText);
        this.isRejectedAppsTrendPositive.set(rejectedTrendRes.isPositive);

        this.applicationDistricts.set(
          applications.result.map(app => app.address?.district?.trim() || 'Chưa xác định')
        );

        const markers = applications.result.map(
          (app, index) => createVenueMapMarker(app, index)
        );

        this.unlocatedVenueCount.set(markers.filter(marker => marker.isFallback).length);
        this.mapMarkers.set(markers);
        this.dashboardMap.render(markers);

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
        this.loading.set(false);
      }
    });
  }

  ngAfterViewInit() {
    this.dashboardMap.init('real-leaflet-map');
  }

  ngOnDestroy(): void {
    this.dashboardMap.destroy();
  }

  toggleMapStatus(status: OwnerApplicationStatus): void {
    this.selectedMapStatus.update(current => current === status ? null : status);
    this.dashboardMap.render(this.filteredMapMarkers());
  }

  getMapMarkerCount(status: OwnerApplicationStatus): number {
    return this.mapMarkers().filter(marker => marker.status === status).length;
  }

  fetchWeather() {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=10.823&longitude=106.63&current_weather=true')
      .then(res => res.json())
      .then(data => {
        if (data?.current_weather) {
          const parsed = parseWeatherCode(data.current_weather.weathercode);
          this.weather.set({
            temp: Math.round(data.current_weather.temperature),
            ...parsed
          });
        }
      })
      .catch(() => { /* default fallback */ });
  }

  generateCalendar() {
    const calendar = createCalendarGrid(new Date());
    this.currentDay = calendar.currentDay;
    this.calendarOffsetCells = calendar.offsetCells;
    this.calendarDays = calendar.days;
  }
}
