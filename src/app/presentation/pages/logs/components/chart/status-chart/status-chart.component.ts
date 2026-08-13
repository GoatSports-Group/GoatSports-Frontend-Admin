import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { StatusDistribution } from '../../models';
import { DonutSegment } from './status-chart.models';
import { calculateDonutChart } from './status-chart.utils';

@Component({
  selector: 'app-status-chart',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  templateUrl: './status-chart.component.html',
  styleUrls: ['./status-chart.component.scss']
})
export class StatusChartComponent implements OnChanges {
  @Input() distribution: StatusDistribution | null = null;
  @Input() loading = false;

  total = 0;
  segments: DonutSegment[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['distribution']) {
      this.calculateSegments();
    }
  }

  calculateSegments(): void {
    const chart = calculateDonutChart(this.distribution);
    this.total = chart.total;
    this.segments = chart.segments;
  }
}
