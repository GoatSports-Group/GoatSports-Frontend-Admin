import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { StatusDistribution } from '../../models';

interface DonutSegment {
  label: string;
  value: number;
  percentage: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

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
    if (!this.distribution) {
      this.total = 0;
      this.segments = [];
      return;
    }

    const { status2xx, status3xx, status4xx, status5xx } = this.distribution;
    this.total = status2xx + status3xx + status4xx + status5xx;

    if (this.total === 0) {
      this.segments = [];
      return;
    }

    const dataRaw = [
      { label: 'Thành công (2xx)', value: status2xx, color: '#10b981' },
      { label: 'Chuyển hướng (3xx)', value: status3xx, color: '#3b82f6' },
      { label: 'Lỗi phía Client (4xx)', value: status4xx, color: '#f97316' },
      { label: 'Lỗi phía Server (5xx)', value: status5xx, color: '#ef4444' }
    ];

    let cumulativePercentage = 0;
    this.segments = dataRaw.map(item => {
      const pct = (item.value / this.total) * 100;
      const dashArray = `${pct} ${100 - pct}`;

      // Calculate offset based on cumulative starting percentage
      const dashOffset = cumulativePercentage;
      cumulativePercentage += pct;

      return {
        label: item.label,
        value: item.value,
        percentage: pct,
        color: item.color,
        dashArray,
        dashOffset: -dashOffset // negative offset rotates segments clockwise
      };
    }).filter(seg => seg.value > 0); // Only display segments with values > 0
  }
}
