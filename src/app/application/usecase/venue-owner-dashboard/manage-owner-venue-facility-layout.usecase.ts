import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  VenueFacilityLayout,
  VenueFacilityLayoutUpdate
} from '@application/dto/venue-owner-dashboard/venue-facility-layout.dto';
import {
  VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN,
  VenueOwnerDashboardRepository
} from '@application/ports/persistence/venue-owner-dashboard.repository';

@Injectable({ providedIn: 'root' })
export class ManageOwnerVenueFacilityLayoutUseCase {
  constructor(
    @Inject(VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN)
    private readonly repository: VenueOwnerDashboardRepository
  ) { }

  get(venueId: string): Observable<VenueFacilityLayout | null> {
    return this.repository.getVenueFacilityLayout(venueId);
  }

  save(venueId: string, request: VenueFacilityLayoutUpdate): Observable<VenueFacilityLayout> {
    return this.repository.updateVenueFacilityLayout(venueId, request);
  }
}
