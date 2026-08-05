import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';
import { StatusDistribution } from '../models';

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
  template: `
    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col h-[300px] hover:shadow-md transition-shadow duration-300">
      <div class="flex items-center justify-between mb-4">
          <h1 class="font-bold text-slate-600 text-sm tracking-tight">Phân bố mã trạng thái HTTP</h1>
      </div>
      
      <div class="flex-1 flex flex-col sm:flex-row items-center justify-center gap-8 min-h-0">
        @if (loading) {
          <!-- Skeleton Loading -->
          <div class="flex items-center justify-center gap-8 w-full py-6 animate-pulse">
            <div class="w-32 h-32 rounded-full border-8 border-slate-100 flex items-center justify-center"></div>
            <div class="flex flex-col gap-2 flex-1 max-w-[150px]">
              <div class="h-3 bg-slate-100 rounded w-full"></div>
              <div class="h-3 bg-slate-100 rounded w-5/6"></div>
              <div class="h-3 bg-slate-100 rounded w-2/3"></div>
            </div>
          </div>
        } @else if (total === 0) {
          <div class="flex flex-col items-center justify-center text-slate-400 text-xs py-8">
            <lucide-icon name="pie-chart" class="h-8 w-8 text-slate-300 mb-2"></lucide-icon>
            <span>Không có dữ liệu trạng thái</span>
          </div>
        } @else {
          <!-- SVG Donut Chart -->
          <div class="relative w-44 h-44 shrink-0">
            <svg viewBox="0 0 42 42" class="w-full h-full -rotate-90">
              <!-- Background circle -->
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" stroke-width="5.5"></circle>
              
              <!-- Segment circles -->
              @for (seg of segments; track seg.label) {
                <circle cx="21" cy="21" r="15.915" 
                        fill="transparent" 
                        [attr.stroke]="seg.color" 
                        stroke-width="5.5"
                        [attr.stroke-dasharray]="seg.dashArray"
                        [attr.stroke-dashoffset]="seg.dashOffset"
                        stroke-linecap="round"
                        class="transition-all duration-500 ease-out">
                </circle>
              }
            </svg>
            <!-- Center Total Text -->
            <div class="absolute inset-0 flex flex-col items-center justify-center select-none">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng</span>
              <span class="text-2xl font-black text-slate-800 leading-none mt-1">{{ total | number }}</span>
            </div>
          </div>

          <!-- Legend list -->
          <div class="flex flex-col gap-2.5 flex-1 min-w-[150px] font-sans">
            @for (seg of segments; track seg.label) {
              <div class="flex items-center justify-between text-sm font-semibold text-slate-700">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.backgroundColor]="seg.color"></span>
                  <span class="text-slate-600 truncate max-w-[150px]" [title]="seg.label">{{ seg.label }}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 pl-2">
                  <span class="text-slate-800 font-bold text-sm">{{ seg.value | number }}</span>
                  <span class="text-sm text-slate-400 font-bold">({{ seg.percentage | number:'1.0-0' }}%)</span>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `
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
      // Shifting stroke backwards: offset = 100 - cumulativePercentage
      const dashOffset = cumulativePercentage === 0 ? 0 : 100 - cumulativePercentage;
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
