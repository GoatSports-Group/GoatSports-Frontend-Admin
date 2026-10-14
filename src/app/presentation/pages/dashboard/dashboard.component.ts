import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Injector, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, viewChild } from '@angular/core';
import { TwoWayWindow } from '@shared/utils/two-way-window';
import { SERVER_MAX_PAGE_SIZE, fetchAllPages } from '@shared/utils/fetch-all-pages';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { AuthService } from '@presentation/services/auth.service';
import { parseWeatherCode } from '@shared/utils/weather-parser.utils';
import { ProvinceBreakdownItem, VenueMapMarker } from './dashboard.models';
import { WeatherInfo } from '@shared/components/ui/weather-widget/weather-widget.models';
import { buildProvinceBreakdown, createVenueMapMarker } from './dashboard.utils';
import { DashboardMapService } from './dashboard-map.service';
import { VenueOwnerDashboardComponent } from '../venue-owner-dashboard/venue-owner-dashboard.component';
import { AdminOverviewComponent } from './admin-overview/admin-overview.component';

/**
 * Trang đầu của admin app. Chủ sân: bảng điều khiển cơ sở. Admin: tổng quan hệ thống (số liệu từ các service)
 * và bản đồ đơn đăng ký chủ sân theo quận / huyện.
 */
@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideIconComponent, InfiniteScrollDirective, VenueOwnerDashboardComponent, AdminOverviewComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  providers: [DashboardMapService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardOverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  private getAllApplicationsUseCase = inject(GetAllOwnerApplicationsUseCase);
  private authService = inject(AuthService);
  private dashboardMap = inject(DashboardMapService);

  adminName = 'Quản Trị Viên';

  userRole = signal<string>('ADMIN');
  isVenueOwner = computed(() => this.userRole() === 'VENUE_OWNER');
  /** ADMIN và vai trò admin tự tạo (guard đã kiểm quyền GET_PLATFORM_STATS) xem Tổng quan nền tảng. */
  isAdmin = computed(() => !this.isVenueOwner());

  /** null = đang tải (khối "Cần xử lý" hiện skeleton thay vì báo 0). */
  pendingApps = signal<number | null>(null);
  applicationsFailed = signal(false);

  // Bản đồ đơn đăng ký chủ sân
  mapMarkers = signal<VenueMapMarker[]>([]);
  applications = signal<OwnerApplication[]>([]);
  selectedMapStatus = signal<OwnerApplicationStatus | null>(null);

  filteredMapMarkers = computed(() => {
    const status = this.selectedMapStatus();
    return status ? this.mapMarkers().filter(marker => marker.status === status) : this.mapMarkers();
  });

  provinceBreakdown = computed(() => buildProvinceBreakdown(this.applications()));
  /** Thanh của mỗi tỉnh tỉ lệ với tỉnh nhiều hồ sơ nhất. */
  provinceMax = computed(() => Math.max(1, ...this.provinceBreakdown().map(item => item.count)));
  /** Danh sách tỉnh cuộn vô hạn: render 10 dòng mỗi lần, tối đa 30 dòng cùng lúc. */
  readonly provinceWindow = new TwoWayWindow(this.provinceBreakdown, item => item.name, inject(Injector), 10, 30);
  private readonly provinceList = viewChild<ElementRef<HTMLElement>>('provinceList');
  /** Tỉnh / thành đang mở popup chi tiết (quận / huyện và trạng thái từng hồ sơ). */
  selectedProvince = signal<ProvinceBreakdownItem | null>(null);
  readonly mapStatuses = [
    { status: OwnerApplicationStatus.APPROVED, label: 'Đã duyệt', tone: 'approved' },
    { status: OwnerApplicationStatus.PENDING, label: 'Chờ duyệt', tone: 'pending' },
    { status: OwnerApplicationStatus.REJECTED, label: 'Từ chối', tone: 'rejected' }
  ] as const;
  readonly statusLabel: Readonly<Record<OwnerApplicationStatus, { label: string; tone: string }>> = {
    [OwnerApplicationStatus.APPROVED]: { label: 'Đã duyệt', tone: 'success' },
    [OwnerApplicationStatus.PENDING]: { label: 'Chờ duyệt', tone: 'warning' },
    [OwnerApplicationStatus.REJECTED]: { label: 'Từ chối', tone: 'danger' },
    [OwnerApplicationStatus.CANCELLED]: { label: 'Đã hủy', tone: 'neutral' }
  };

  weather = signal<WeatherInfo | null>(null);
  weatherLoading = signal(false);
  weatherError = signal<string | null>(null);

  readonly OwnerApplicationStatus = OwnerApplicationStatus;

  ngOnInit() {
    const currentUser = this.authService.currentUser;
    this.adminName = currentUser?.fullName || 'Quản Trị Viên';
    this.userRole.set(currentUser?.role?.name || 'ADMIN');
    if (this.isVenueOwner()) this.fetchWeather();
    if (this.isAdmin()) this.loadApplications();
  }

  loadApplications() {
    // Server trả tối đa 20 đơn mỗi trang (xin size 1000 vẫn chỉ được 20), nên tải đủ mọi trang để vẽ bản đồ.
    fetchAllPages(page => this.getAllApplicationsUseCase.execute({ page, size: SERVER_MAX_PAGE_SIZE })).subscribe({
      next: applications => {
        this.pendingApps.set(applications.filter(a => a.status === OwnerApplicationStatus.PENDING).length);
        this.applications.set(applications);
        const markers = applications.map((app, index) => createVenueMapMarker(app, index));
        this.mapMarkers.set(markers);
        this.dashboardMap.render(markers);
      },
      error: () => this.applicationsFailed.set(true)
    });
  }

  ngAfterViewInit() {
    if (this.isAdmin()) this.dashboardMap.init('real-leaflet-map');
  }

  ngOnDestroy(): void {
    if (this.isAdmin()) this.dashboardMap.destroy();
  }

  showMoreProvinces(): void {
    this.provinceWindow.next(this.provinceList()?.nativeElement);
  }

  showPreviousProvinces(): void {
    this.provinceWindow.previous(this.provinceList()?.nativeElement);
  }

  @HostListener('document:keydown.escape')
  closeProvince(): void {
    this.selectedProvince.set(null);
  }

  toggleMapStatus(status: OwnerApplicationStatus): void {
    this.selectedMapStatus.update(current => current === status ? null : status);
    this.dashboardMap.render(this.filteredMapMarkers());
  }

  getMapMarkerCount(status: OwnerApplicationStatus): number {
    return this.mapMarkers().filter(marker => marker.status === status).length;
  }

  fetchWeather(): void {
    if (this.weatherLoading()) return;
    this.weatherLoading.set(true);
    this.weatherError.set(null);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=10.823&longitude=106.63&current_weather=true')
      .then(response => {
        if (!response.ok) throw new Error(`WEATHER_HTTP_${response.status}`);
        return response.json();
      })
      .then(data => {
        if (!data?.current_weather || !Number.isFinite(data.current_weather.temperature)) {
          throw new Error('WEATHER_RESPONSE_INVALID');
        }
        this.weather.set({ temp: Math.round(data.current_weather.temperature), ...parseWeatherCode(data.current_weather.weathercode) });
      })
      .catch(() => {
        this.weather.set(null);
        this.weatherError.set('Không thể kết nối nhà cung cấp thời tiết.');
      })
      .finally(() => this.weatherLoading.set(false));
  }
}
