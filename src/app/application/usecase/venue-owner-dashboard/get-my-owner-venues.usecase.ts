import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import {
  VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN,
  VenueOwnerDashboardRepository
} from '@application/ports/persistence/venue-owner-dashboard.repository';

@Injectable({ providedIn: 'root' })
export class GetMyOwnerVenuesUseCase {
  constructor(
    @Inject(VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN)
    private readonly repository: VenueOwnerDashboardRepository
  ) { }

  execute(): Observable<OwnerVenueOverview[]> {
    return this.repository.getMyVenues();
  }
}
