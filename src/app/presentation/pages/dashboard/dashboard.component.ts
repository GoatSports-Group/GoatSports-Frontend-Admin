import { ChangeDetectionStrategy, Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { AuthService } from '@presentation/services/auth.service';
import { parseWeatherCode } from '@shared/utils/weather-parser.utils';
import { VenueMapMarker } from './dashboard.models';
import { WeatherInfo } from '@shared/components/ui/weather-widget/weather-widget.models';
import { buildDistrictBreakdown, createVenueMapMarker } from './dashboard.utils';
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
  imports: [CommonModule, VenueOwnerDashboardComponent, AdminOverviewComponent],
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
  isAdmin = computed(() => this.userRole() === 'ADMIN');

  pendingApps = signal(0);

  // Bản đồ đơn đăng ký chủ sân
  mapMarkers = signal<VenueMapMarker[]>([]);
  applicationDistricts = signal<string[]>([]);
  selectedMapStatus = signal<OwnerApplicationStatus | null>(null);

  filteredMapMarkers = computed(() => {
    const status = this.selectedMapStatus();
    return status ? this.mapMarkers().filter(marker => marker.status === status) : this.mapMarkers();
  });

  districtBreakdown = computed(() => buildDistrictBreakdown(this.applicationDistricts()));
  /** Thanh của mỗi quận tỉ lệ với quận nhiều cơ sở nhất (trước đây chia cho tổng số người dùng). */
  districtMax = computed(() => Math.max(1, ...this.districtBreakdown().map(item => item.count)));

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
    // ponytail: tải tối đa 1000 đơn đăng ký để vẽ bản đồ; đổi sang API đếm/tọa độ riêng nếu vượt con số này.
    this.getAllApplicationsUseCase.execute({ page: 0, size: 1000 }).subscribe({
      next: applications => {
        this.pendingApps.set(applications.result.filter(a => a.status === OwnerApplicationStatus.PENDING).length);
        this.applicationDistricts.set(applications.result.map(app => app.address?.district?.trim() || 'Chưa xác định'));
        const markers = applications.result.map((app, index) => createVenueMapMarker(app, index));
        this.mapMarkers.set(markers);
        this.dashboardMap.render(markers);
      },
      error: err => console.error('Dashboard load error:', err)
    });
  }

  ngAfterViewInit() {
    if (this.isAdmin()) this.dashboardMap.init('real-leaflet-map');
  }

  ngOnDestroy(): void {
    if (this.isAdmin()) this.dashboardMap.destroy();
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
