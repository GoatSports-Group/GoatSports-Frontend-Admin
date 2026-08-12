import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { ChartDataPoint } from '../../models';

@Component({
  selector: 'app-traffic-chart',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  templateUrl: './traffic-chart.component.html',
  styleUrls: ['./traffic-chart.component.scss']
})
export class TrafficChartComponent implements OnChanges {
  @Input() data: ChartDataPoint[] = [];
  @Input() loading = false;

  points: { x: number; y: number }[] = [];
  linePath = '';
  areaPath = '';

  hoverIndex: number | null = null;
  hoverX: number | null = null;
  hoverY: number | null = null;
  tooltipX = 0;
  tooltipY = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.generatePaths();
    }
  }

  generatePaths(): void {
    if (!this.data || this.data.length === 0) {
      this.points = [];
      this.linePath = '';
      this.areaPath = '';
      return;
    }

    const maxVal = Math.max(...this.data.map(d => d.value), 1);
    const len = this.data.length;

    this.points = this.data.map((d, i) => {
      // Map x from 1.5% to 98.5%
      const x = len > 1 ? 1.5 + (i * 97) / (len - 1) : 50;
      // Map y from 15% (peak) to 88% (baseline)
      const y = 88 - (d.value * 73) / maxVal;
      return { x, y };
    });

    if (this.points.length > 0) {
      this.linePath = this.points.reduce((path, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`;
      }, '');

      const firstX = this.points[0].x;
      const lastX = this.points[this.points.length - 1].x;
      this.areaPath = `M ${firstX} 90 L ${this.linePath.substring(2)} L ${lastX} 90 Z`;
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.data || this.data.length === 0 || this.points.length === 0) return;

    const svg = event.currentTarget as SVGElement;
    const rect = svg.getBoundingClientRect();

    const relativeX = (event.clientX - rect.left) / rect.width;

    const index = Math.min(
      this.points.length - 1,
      Math.max(0, Math.round(relativeX * (this.points.length - 1)))
    );

    this.hoverIndex = index;
    const pt = this.points[index];

    this.hoverX = pt.x;
    this.hoverY = pt.y;

    const tooltipWidth = 110;
    const tooltipHeight = 55;

    this.tooltipX = (pt.x / 100) * rect.width - tooltipWidth / 2;

    if (this.tooltipX < 5) this.tooltipX = 5;
    if (this.tooltipX + tooltipWidth > rect.width - 5) this.tooltipX = rect.width - tooltipWidth - 5;

    this.tooltipY = (pt.y / 100) * rect.height - tooltipHeight - 8;
    if (this.tooltipY < 5) this.tooltipY = (pt.y / 100) * rect.height + 12;
  }

  clearHover(): void {
    this.hoverIndex = null;
    this.hoverX = null;
    this.hoverY = null;
  }
}
