import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { MetricRailItem } from './metric-rail.models';

@Component({
  selector: 'app-metric-rail',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './metric-rail.component.html',
  styleUrl: './metric-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricRailComponent {
  readonly items = input.required<readonly MetricRailItem[]>();
  readonly label = input('Tổng quan vận hành');
}
