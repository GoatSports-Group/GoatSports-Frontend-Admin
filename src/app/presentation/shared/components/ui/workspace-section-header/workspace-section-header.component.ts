import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-workspace-section-header',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './workspace-section-header.component.html',
  styleUrl: './workspace-section-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceSectionHeaderComponent {
  readonly headingId = input.required<string>();
  readonly title = input.required<string>();
  readonly eyebrow = input<string>();
  readonly description = input<string>();
  readonly icon = input<string>();
}
