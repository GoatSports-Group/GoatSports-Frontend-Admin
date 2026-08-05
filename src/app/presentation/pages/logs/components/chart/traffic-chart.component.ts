import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';
import { ChartDataPoint } from '../models';

@Component({
  selector: 'app-traffic-chart',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  template: `
    <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col h-[300px] hover:shadow-md transition-shadow duration-300">
      <div class="flex items-center justify-between mb-4 shrink-0">
          <h1 class="font-bold text-slate-600 text-sm tracking-tight">Lưu lượng yêu cầu trong ngày</h1>
      </div>
      
      <!-- Scroll container for narrow screens to ensure 24h charts remain legible -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden w-full relative min-h-0 select-none scrollbar-thin" (mouseleave)="clearHover()">
        @if (loading) {
          <div class="absolute inset-0 flex flex-col gap-3 items-center justify-center">
            <div class="w-8 h-8 rounded-full border-4 border-slate-100 border-t-emerald-500 animate-spin"></div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang tính toán biểu đồ...</span>
          </div>
        } @else if (data.length === 0) {
          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold">
            <lucide-icon name="activity" class="h-8 w-8 text-slate-300 mb-2"></lucide-icon>
            <span>Không có dữ liệu</span>
          </div>
        } @else {
          <!-- Set a minimum width on the chart drawing area for horizontal scrolling when screen is narrow -->
          <div class="min-w-[650px] h-[190px] relative mt-1">
            
            <!-- SVG Line Chart -->
            <svg class="w-full h-[165px]" viewBox="0 0 100 100" preserveAspectRatio="none" (mousemove)="onMouseMove($event)">
              <!-- Gradients -->
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.15" />
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0.00" />
                </linearGradient>
              </defs>

              <!-- Y-Axis Grid lines -->
              <line x1="0" y1="20" x2="100" y2="20" stroke="#f8fafc" stroke-width="0.5" />
              <line x1="0" y1="45" x2="100" y2="45" stroke="#f8fafc" stroke-width="0.5" />
              <line x1="0" y1="70" x2="100" y2="70" stroke="#f8fafc" stroke-width="0.5" />
              <line x1="0" y1="90" x2="100" y2="90" stroke="#f1f5f9" stroke-width="0.75" />
              
              <!-- Area Path -->
              <path [attr.d]="areaPath" fill="url(#areaGrad)" class="transition-all duration-500" />
              
              <!-- Line Path -->
              <path [attr.d]="linePath" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="transition-all duration-500" />
              
              <!-- Dots on peaks -->
              @for (pt of points; track $index) {
                <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="0.8" fill="white" stroke="#10b981" stroke-width="0.5" class="transition-all duration-500" />
              }

              <!-- Hover vertical indicator line -->
              @if (hoverIndex !== null && hoverX !== null) {
                <line [attr.x1]="hoverX" y1="0" [attr.x2]="hoverX" y2="90" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="2" />
                <circle [attr.cx]="hoverX" [attr.cy]="hoverY" r="1.5" fill="#10b981" stroke="white" stroke-width="0.75" />
              }
            </svg>
            
            <!-- Tooltip overlay -->
            @if (hoverIndex !== null && data[hoverIndex]) {
              <div class="absolute bg-slate-900/95 text-white rounded-xl p-2.5 text-[10px] pointer-events-none shadow-lg flex flex-col gap-0.5 border border-slate-800 transition-all duration-75 z-50 shrink-0"
                   [style.left.px]="tooltipX"
                   [style.top.px]="tooltipY">
                <span class="font-bold text-slate-400">{{ data[hoverIndex].label }}</span>
                <span class="font-extrabold text-[12px] text-emerald-400 mt-0.5">{{ data[hoverIndex].value | number }} yêu cầu</span>
              </div>
            }

            <!-- X Axis Labels absolutely positioned under corresponding peaks -->
            <div class="absolute left-0 right-0 bottom-0 h-4 border-t border-slate-100/80 pt-1.5">
              @for (lbl of data; track lbl.label; let first = $first; let last = $last; let index = $index) {
                @if (first || last || index % 3 === 0) {
                  <span class="absolute text-[9px] font-extrabold text-slate-400 tracking-wider transition-all duration-300"
                        [style.left.%]="(index / (data.length - 1)) * 100"
                        [class]="index === 0 ? '-translate-x-0' : (index === data.length - 1 ? '-translate-x-full' : '-translate-x-1/2')">
                    {{ lbl.label }}
                  </span>
                }
              }
            </div>

          </div>
        }
      </div>
    </div>
  `
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
