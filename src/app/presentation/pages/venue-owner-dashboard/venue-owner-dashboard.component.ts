import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize, take } from 'rxjs';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { GetOwnerVenueOverviewUseCase } from '@application/usecase/venue-owner-dashboard/get-owner-venue-overview.usecase';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OwnerApplicationProgressComponent } from '../dashboard/owner-application-progress/owner-application-progress.component';
import { OwnerFeatureGridComponent } from './owner-feature-grid/owner-feature-grid.component';
import { OwnerVenueOverviewComponent } from './owner-venue-overview/owner-venue-overview.component';
import { OWNER_WORKSPACE_FEATURES } from './venue-owner-dashboard.models';

@Component({
  selector: 'app-venue-owner-dashboard',
  standalone: true,
  imports: [
    OwnerApplicationProgressComponent,
    OwnerFeatureGridComponent,
    OwnerVenueOverviewComponent
  ],
  templateUrl: './venue-owner-dashboard.component.html',
  styleUrl: './venue-owner-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerDashboardComponent {
  private readonly getMyApplications = inject(GetMyOwnerApplicationsUseCase);
  private readonly getVenueOverview = inject(GetOwnerVenueOverviewUseCase);

  readonly applicationUrl = '/admin/applications';
  readonly features = OWNER_WORKSPACE_FEATURES;
  readonly applications = signal<OwnerApplication[]>([]);
  readonly applicationLoading = signal(false);
  readonly applicationError = signal<string | null>(null);
  readonly venue = signal<OwnerVenueOverview | null>(null);
  readonly venueLoading = signal(false);
  readonly venueError = signal<string | null>(null);

  readonly approvedApplication = computed(() =>
    this.applications().find(application =>
      application.status === OwnerApplicationStatus.APPROVED && Boolean(application.venueId)
    ) ?? null
  );
  readonly applicationApproved = computed(() => Boolean(this.approvedApplication()));

  constructor() {
    this.loadApplications();
  }

  loadApplications(): void {
    if (this.applicationLoading()) return;
    this.applicationLoading.set(true);
    this.applicationError.set(null);

    this.getMyApplications.execute({ page: 0, size: 20 }).pipe(
      take(1),
      finalize(() => this.applicationLoading.set(false))
    ).subscribe({
      next: response => {
        const applications = [...(response.result ?? [])].sort((left, right) =>
          this.timestamp(right.createdAt) - this.timestamp(left.createdAt)
        );
        this.applications.set(applications);
        const approved = applications.find(application =>
          application.status === OwnerApplicationStatus.APPROVED && Boolean(application.venueId)
        );
        if (approved?.venueId) this.loadVenue(approved.venueId);
      },
      error: () => {
        this.applications.set([]);
        this.applicationError.set('Không thể tải tiến trình lúc này. Vui lòng thử lại.');
      }
    });
  }

  retryVenue(): void {
    const venueId = this.approvedApplication()?.venueId;
    if (venueId) this.loadVenue(venueId);
  }

  private loadVenue(venueId: string): void {
    if (this.venueLoading()) return;
    this.venueLoading.set(true);
    this.venueError.set(null);
    this.getVenueOverview.execute(venueId).pipe(
      take(1),
      finalize(() => this.venueLoading.set(false))
    ).subscribe({
      next: venue => this.venue.set(venue),
      error: () => {
        this.venue.set(null);
        this.venueError.set('Venue Service chưa trả về được thông tin cơ sở.');
      }
    });
  }

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
