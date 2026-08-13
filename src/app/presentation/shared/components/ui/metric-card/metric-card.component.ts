import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [
    CommonModule,
    LucideIconComponent
  ],
  templateUrl: './metric-card.component.html',
  styleUrls: ['./metric-card.component.scss']
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
