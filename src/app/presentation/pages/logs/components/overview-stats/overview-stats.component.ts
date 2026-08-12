import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogStats } from '../models';
import { KpiCardsComponent } from '../kpi/kpi-cards/kpi-cards.component';
import { TrafficChartComponent } from '../chart/traffic-chart/traffic-chart.component';
import { StatusChartComponent } from '../chart/status-chart/status-chart.component';

@Component({
  selector: 'app-overview-stats',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardsComponent,
    TrafficChartComponent,
    StatusChartComponent,
  ],
  templateUrl: './overview-stats.component.html',
  styleUrls: ['./overview-stats.component.scss']
})
export class OverviewStatsComponent {
  @Input() stats: LogStats | null = null;
  @Input() loading = false;
}
