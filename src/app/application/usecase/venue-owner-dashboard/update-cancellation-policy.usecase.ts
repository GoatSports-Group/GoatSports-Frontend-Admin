import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CancellationPolicy,
  CancellationPolicyUpdate
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import {
  VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN,
  VenueOwnerDashboardRepository
} from '@application/ports/persistence/venue-owner-dashboard.repository';

@Injectable({ providedIn: 'root' })
export class UpdateCancellationPolicyUseCase {
  constructor(
    @Inject(VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN)
    private readonly repository: VenueOwnerDashboardRepository
  ) { }

  execute(venueId: string, request: CancellationPolicyUpdate): Observable<CancellationPolicy> {
    return this.repository.updateCancellationPolicy(venueId, request);
  }
}
