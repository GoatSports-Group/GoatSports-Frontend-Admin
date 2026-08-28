import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { findOwnerWorkspaceFeature } from '../venue-owner-dashboard.models';

@Component({
  selector: 'app-owner-feature-placeholder',
  standalone: true,
  imports: [RouterLink, LucideIconComponent],
  templateUrl: './owner-feature-placeholder.component.html',
  styleUrl: './owner-feature-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerFeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly feature = computed(() =>
    findOwnerWorkspaceFeature(this.route.snapshot.data['featureId'])
  );
}
