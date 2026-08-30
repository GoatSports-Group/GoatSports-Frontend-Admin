import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { OwnerWorkspaceFeature } from '../venue-owner-dashboard.models';

@Component({
  selector: 'app-owner-feature-grid',
  standalone: true,
  imports: [RouterModule, LucideIconComponent],
  templateUrl: './owner-feature-grid.component.html',
  styleUrl: './owner-feature-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerFeatureGridComponent {
  readonly features = input.required<readonly OwnerWorkspaceFeature[]>();
  readonly operationsEnabled = input(false);
  readonly lockReason = input('Chưa thể mở khóa vận hành');

  readonly operationFeatures = computed(() => this.features().filter(feature => feature.id !== 'application'));
}
