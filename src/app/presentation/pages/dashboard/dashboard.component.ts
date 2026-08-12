import { Component, OnInit, AfterViewInit, inject, signal, computed } from '@angular/core';
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

export interface WeatherInfo {
  temp: number;
  condition: string;
  icon: string;
  description: string;
}

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
  styleUrl: './dashboard.component.scss'
})
export class DashboardOverviewComponent implements OnInit, AfterViewInit {
  private userService = inject(UserService);
  private getAllApplicationsUseCase = inject(GetAllOwnerApplicationsUseCase);
  private authService = inject(AuthService);

  private leafletMap: any;
  private markersGroup: any;

  currentDate = new Date();
  adminName = 'Quản Trị Viên';

  get formattedDateVi(): string {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[this.currentDate.getDay()];
    const date = this.currentDate.getDate().toString().padStart(2, '0');
    const month = (this.currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = this.currentDate.getFullYear();
    return `${dayName}, ngày ${date} tháng ${month} năm ${year}`;
  }

  get formattedMonthYearVi(): string {
    const month = (this.currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = this.currentDate.getFullYear();
    return `Tháng ${month} năm ${year}`;
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
  mapMarkers = signal<Array<{
    lat: number;
    lng: number;
    businessName: string;
    fullName: string;
    addressText: string;
    status: string;
    district: string;
  }>>([]);

  districtBreakdown = computed(() => {
    const counts: { [key: string]: number } = {};
    this.mapMarkers().forEach(m => {
      let name = m.district.replace(/(quận|q\.|q)/i, '').trim();
      if (!name) name = 'Khác';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts).map(key => {
      const cleanKey = key.trim();
      const name = isNaN(Number(cleanKey)) ? cleanKey : `Quận ${cleanKey}`;
      return {
        name,
        count: counts[cleanKey]
      };
    }).sort((a, b) => b.count - a.count);
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

        // Map markers for geolocation using real coordinates
        const markers = applications.result.map(app => {
          const district = app.address?.district || 'Hồ Chí Minh';
          const latLng = this.getDistrictLatLng(district);
          // Add a tiny random offset to prevent direct overlaps in the same district
          const jitterLat = latLng[0] + (Math.random() - 0.5) * 0.015;
          const jitterLng = latLng[1] + (Math.random() - 0.5) * 0.015;

          return {
            lat: jitterLat,
            lng: jitterLng,
            businessName: app.businessName,
            fullName: app.fullName,
            addressText: `${app.address?.address || ''}, ${app.address?.ward || ''}, ${district}, ${app.address?.city || ''}`,
            status: app.status,
            district: district
          };
        });
        this.mapMarkers.set(markers);
        this.renderMarkersOnMap();

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
        this.loading.set(false);
      }
    });
  }

  ngAfterViewInit() {
    this.initRealMap();
  }

  private initRealMap() {
    if ((window as any).L) {
      this.createLeafletMap();
      return;
    }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      this.createLeafletMap();
    };
    document.body.appendChild(script);
  }

  private createLeafletMap() {
    const L = (window as any).L;
    const mapEl = document.getElementById('real-leaflet-map');
    if (!L || !mapEl || this.leafletMap) return;

    // Initialize Map centered in HCMC
    this.leafletMap = L.map('real-leaflet-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([10.7760, 106.7009], 11);

    // Add CartoDB Voyager tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.leafletMap);

    // Create marker layer group
    this.markersGroup = L.layerGroup().addTo(this.leafletMap);

    // Render markers on map
    this.renderMarkersOnMap();
  }

  private renderMarkersOnMap() {
    const L = (window as any).L;
    if (!L || !this.leafletMap || !this.markersGroup) return;

    this.markersGroup.clearLayers();

    this.mapMarkers().forEach(marker => {
      // Color based on status
      let color = '#10b981'; // green
      if (marker.status === 'PENDING') color = '#f59e0b'; // amber
      if (marker.status === 'REJECTED') color = '#ef4444'; // rose

      // Dynamic CSS circle marker
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-4 w-4 rounded-full opacity-60 animate-ping" style="background-color: ${color}"></span>
            <span class="relative block h-4 w-4 rounded-full border-2 border-white shadow-md" style="background-color: ${color}"></span>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      // Bind dynamic tooltip/popup
      const popupContent = `
        <div class="p-2 select-none font-display">
          <strong class="block text-xs font-black text-emerald-600">${marker.businessName}</strong>
          <span class="block text-[12px] text-slate-500 font-bold mt-0.5">Chủ sở hữu: ${marker.fullName}</span>
          <span class="block text-[10px] text-slate-500 font-medium leading-snug mt-1">${marker.addressText}</span>
        </div>
      `;

      L.marker([marker.lat, marker.lng], { icon: customIcon })
        .bindPopup(popupContent, { closeButton: false })
        .addTo(this.markersGroup);
    });
  }

  private getDistrictLatLng(district: string): [number, number] {
    const d = district.toLowerCase();

    // Core districts
    if (d.includes('quận 1') || d.includes('q.1') || d.includes('q1')) return [10.7760, 106.7009];
    if (d.includes('quận 3') || d.includes('q.3') || d.includes('q3')) return [10.7785, 106.6806];
    if (d.includes('quận 5') || d.includes('q.5') || d.includes('q5')) return [10.7554, 106.6625];
    if (d.includes('quận 10') || d.includes('q.10') || d.includes('q10')) return [10.7725, 106.6681];
    if (d.includes('quận 11') || d.includes('q.11') || d.includes('q11')) return [10.7630, 106.6495];
    if (d.includes('quận 4') || d.includes('q.4') || d.includes('q4')) return [10.7634, 106.7061];
    if (d.includes('quận 6') || d.includes('q.6') || d.includes('q6')) return [10.7483, 106.6346];
    if (d.includes('quận 8') || d.includes('q.8') || d.includes('q8')) return [10.7228, 106.6333];
    if (d.includes('quận 7') || d.includes('q.7') || d.includes('q7')) return [10.7326, 106.7268];

    // Surrounding districts
    if (d.includes('thủ đức') || d.includes('quận 2') || d.includes('q.2') || d.includes('quận 9') || d.includes('q.9')) return [10.8494, 106.7719];
    if (d.includes('bình thạnh')) return [10.8037, 106.7082];
    if (d.includes('phú nhuận')) return [10.7992, 106.6803];
    if (d.includes('gò vấp')) return [10.8388, 106.6669];
    if (d.includes('tân bình')) return [10.8014, 106.6525];
    if (d.includes('tân phú')) return [10.7900, 106.6187];

    // Outer districts
    if (d.includes('quận 12') || d.includes('q.12') || d.includes('q12')) return [10.8672, 106.6407];
    if (d.includes('bình tân')) return [10.7761, 106.6001];
    if (d.includes('hóc môn')) return [10.8833, 106.5917];
    if (d.includes('củ chi')) return [11.0067, 106.5133];
    if (d.includes('nhà bè')) return [10.6953, 106.7264];
    if (d.includes('bình chánh')) return [10.6875, 106.5938];
    if (d.includes('cần giờ')) return [10.4283, 106.9583];

    return [10.7760, 106.7009];
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
    const today = new Date();
    this.currentDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();
    this.calendarOffsetCells = Array(startDayOfWeek).fill(null);
    this.calendarDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  }

  getFallbackAvatar(user: User): string {
    const seed = encodeURIComponent(user.fullName || user.username);
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=059669&fontColor=ffffff`;
  }
}
