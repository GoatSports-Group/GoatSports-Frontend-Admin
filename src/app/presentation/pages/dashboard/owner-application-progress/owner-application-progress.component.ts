import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OwnerApplication } from '@application/dto/owner-application/owner-application.dto';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import {
  buildOwnerApplicationProgress,
  formatOwnerApplicationAddress,
  getBusinessTypeLabel,
  getOwnerApplicationStatusLabel
} from './owner-application-progress.utils';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-owner-application-progress',
  standalone: true,
  imports: [LoadingSkeletonComponent, CommonModule, LucideIconComponent],
  templateUrl: './owner-application-progress.component.html',
  styleUrl: './owner-application-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerApplicationProgressComponent {
  readonly getAddress = formatOwnerApplicationAddress;
  readonly getBusinessTypeLabel = getBusinessTypeLabel;
  readonly getStatusLabel = getOwnerApplicationStatusLabel;
  readonly application = input<OwnerApplication | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly applicationUrl = input.required<string>();
  readonly compact = input(false);
  readonly retry = output<void>();

  readonly progress = computed(() => {
    const application = this.application();
    return application ? buildOwnerApplicationProgress(application) : null;
  });
}
