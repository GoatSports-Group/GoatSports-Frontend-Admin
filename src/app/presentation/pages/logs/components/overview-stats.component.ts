import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogStats } from './models';
import { KpiCardsComponent } from './kpi/kpi-cards.component';
import { TrafficChartComponent } from './chart/traffic-chart.component';
import { StatusChartComponent } from './chart/status-chart.component';

@Component({
  selector: 'app-overview-stats',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardsComponent,
    TrafficChartComponent,
    StatusChartComponent,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <!-- Section 1: KPI Cards -->
      <app-kpi-cards [stats]="stats" [loading]="loading"></app-kpi-cards>
      
      <!-- Section 2: Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
        <app-traffic-chart [data]="stats ? stats.trafficTrend : []" [loading]="loading"></app-traffic-chart>
        <app-status-chart [distribution]="stats ? stats.statusDistribution : null" [loading]="loading"></app-status-chart>
      </div>
    </div>
  `
})
export class OverviewStatsComponent {
  @Input() stats: LogStats | null = null;
  @Input() loading = false;
}
