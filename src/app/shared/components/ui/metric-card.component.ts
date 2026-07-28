import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [
    CommonModule,
    LucideIconComponent
  ],
  template: `
    <div class="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/85 p-6 backdrop-blur-xl shadow-xl shadow-slate-950/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/40">
      <!-- Glow ambient gradient background orb -->
      <div 
        class="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        [ngClass]="glowClass">
      </div>

      <div class="flex items-start justify-between gap-4 relative z-10">
        <div class="space-y-2">
          <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-display">{{ title }}</span>
          <div class="flex items-baseline gap-2.5">
            <h3 class="font-display text-3xl font-black tracking-tight text-slate-900">{{ value }}</h3>
            @if (trendText) {
              <span 
                class="inline-flex items-center text-[11px] font-extrabold px-2.5 py-0.5 rounded-full"
                [ngClass]="isPositiveTrend ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'">
                <lucide-icon [name]="isPositiveTrend ? 'trending-up' : 'trending-down'" class="h-3.5 w-3.5 mr-0.5"></lucide-icon>
                {{ trendText }}
              </span>
            }
          </div>
        </div>

        <div 
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-md group-hover:scale-110 transition-transform duration-300"
          [ngClass]="iconBgClass">
          <lucide-icon [name]="icon" class="h-6 w-6"></lucide-icon>
        </div>
      </div>

      @if (description) {
        <div class="mt-4 border-t border-slate-100 pt-3 flex items-center gap-2 relative z-10">
          <span class="inline-block h-2 w-2 rounded-full" [ngClass]="dotColorClass"></span>
          <p class="text-xs text-slate-500 font-semibold truncate">{{ description }}</p>
        </div>
      }
    </div>
  `
})
export class MetricCardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) value!: string | number;
  @Input() icon: string = 'analytics';
  @Input() trendText?: string;
  @Input() isPositiveTrend: boolean = true;
  @Input() description?: string;
  @Input() colorScheme: 'emerald' | 'amber' | 'cyan' | 'rose' | 'purple' = 'emerald';

  get iconBgClass(): string {
    switch (this.colorScheme) {
      case 'emerald': return 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-emerald-500/10';
      case 'amber': return 'bg-amber-50 text-amber-600 border-amber-200 shadow-amber-500/10';
      case 'cyan': return 'bg-sky-50 text-sky-600 border-sky-200 shadow-sky-500/10';
      case 'rose': return 'bg-rose-50 text-rose-600 border-rose-200 shadow-rose-500/10';
      case 'purple': return 'bg-purple-50 text-purple-600 border-purple-200 shadow-purple-500/10';
      default: return 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-emerald-500/10';
    }
  }

  get glowClass(): string {
    switch (this.colorScheme) {
      case 'emerald': return 'bg-emerald-500';
      case 'amber': return 'bg-amber-500';
      case 'cyan': return 'bg-sky-500';
      case 'rose': return 'bg-rose-500';
      case 'purple': return 'bg-purple-500';
      default: return 'bg-emerald-500';
    }
  }

  get dotColorClass(): string {
    switch (this.colorScheme) {
      case 'emerald': return 'bg-emerald-500';
      case 'amber': return 'bg-amber-500';
      case 'cyan': return 'bg-sky-500';
      case 'rose': return 'bg-rose-500';
      case 'purple': return 'bg-purple-500';
      default: return 'bg-emerald-500';
    }
  }
}
