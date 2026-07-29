import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { UserService } from '@presentation/services/user.service';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { User } from '@application/dto/user/user.dto';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { AuthService } from '@presentation/services/auth.service';

import { MetricCardComponent } from '@shared/components/ui/metric-card.component';
import { StatusBadgeComponent } from '@shared/components/ui/status-badge.component';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';

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
    StatusBadgeComponent,
    LucideIconComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardOverviewComponent implements OnInit {
  private userService = inject(UserService);
  private getAllApplicationsUseCase = inject(GetAllOwnerApplicationsUseCase);
  private authService = inject(AuthService);

  currentDate = new Date();
  adminName = 'Quản Trị Viên';

  // Signals State
  loading = signal(false);
  totalUsers = signal(0);
  pendingApps = signal(0);
  approvedApps = signal(0);
  rejectedApps = signal(0);

  // Computed Rates
  approvalRate = computed(() => {
    const total = this.approvedApps() + this.rejectedApps() + this.pendingApps();
    if (total === 0) return 100;
    return Math.round((this.approvedApps() / total) * 100);
  });

  recentUsers = signal<User[]>([]);
  approvedVenues = signal<OwnerApplication[]>([]);
  upcomingSurveys = signal<OwnerApplication[]>([]);

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

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
        this.loading.set(false);
      }
    });
  }

  fetchWeather() {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=10.823&longitude=106.63&current_weather=true')
      .then(res => res.json())
      .then(data => {
        if (data?.current_weather) {
          const parsed = this.parseWeatherCode(data.current_weather.weathercode);
          this.weather.set({
            temp: Math.round(data.current_weather.temperature),
            ...parsed
          });
        }
      })
      .catch(() => { /* default fallback */ });
  }

  parseWeatherCode(code: number): { condition: string; icon: string; description: string } {
    if (code === 0) return { condition: 'clear', icon: 'sun', description: 'Trời nắng đẹp ☀️' };
    if ([1, 2, 3].includes(code)) return { condition: 'cloudy', icon: 'cloud', description: 'Có mây nhẹ ⛅' };
    if ([45, 48].includes(code)) return { condition: 'fog', icon: 'cloud-fog', description: 'Có sương mù 🌫️' };
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { condition: 'rain', icon: 'droplets', description: 'Trời có mưa 🌧️' };
    if ([95, 96, 99].includes(code)) return { condition: 'storm', icon: 'cloud-lightning', description: 'Giông bão ⛈️' };
    return { condition: 'cloudy', icon: 'cloud', description: 'Nhiều mây ☁️' };
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
