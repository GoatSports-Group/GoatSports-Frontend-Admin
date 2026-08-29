import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';
import { WeatherInfo } from './weather-widget.models';

@Component({
  selector: 'app-weather-widget',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './weather-widget.component.html',
  styleUrl: './weather-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeatherWidgetComponent {
  readonly weather = input<WeatherInfo | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly location = input('TP. Hồ Chí Minh');
  readonly retry = output<void>();
}
