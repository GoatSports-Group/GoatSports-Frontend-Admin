import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-owner-venue-overview',
  standalone: true,
  imports: [RouterModule, LucideIconComponent],
  templateUrl: './owner-venue-overview.component.html',
  styleUrl: './owner-venue-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerVenueOverviewComponent {
  readonly venue = input<OwnerVenueOverview | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly retry = output<void>();

  readonly previewCourts = computed(() => this.venue()?.courts?.slice(0, 2) ?? []);
  readonly remainingCourtCount = computed(() => Math.max((this.venue()?.courts?.length ?? 0) - 2, 0));
  readonly addressText = computed(() => {
    const venue = this.venue();
    if (!venue) return '';
    return [venue.address, venue.ward, venue.district, venue.city]
      .map(value => value?.trim())
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(', ');
  });
}
