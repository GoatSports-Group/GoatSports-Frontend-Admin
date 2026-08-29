import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerVenueCourt,
  OwnerVenueCourtUpsert
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import {
  VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN,
  VenueOwnerDashboardRepository
} from '@application/ports/persistence/venue-owner-dashboard.repository';

@Injectable({ providedIn: 'root' })
export class ManageOwnerVenueCourtsUseCase {
  constructor(
    @Inject(VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN)
    private readonly repository: VenueOwnerDashboardRepository
  ) { }

  list(venueId: string): Observable<OwnerVenueCourt[]> {
    return this.repository.getVenueCourts(venueId);
  }

  get(venueCourtId: string): Observable<OwnerVenueCourt> {
    return this.repository.getVenueCourt(venueCourtId);
  }

  create(venueId: string, request: OwnerVenueCourtUpsert): Observable<OwnerVenueCourt> {
    return this.repository.createVenueCourt(venueId, request);
  }

  update(venueCourtId: string, request: OwnerVenueCourtUpsert): Observable<OwnerVenueCourt> {
    return this.repository.updateVenueCourt(venueCourtId, request);
  }

  toggle(venueCourtId: string, active: boolean): Observable<OwnerVenueCourt> {
    return this.repository.updateVenueCourtActive(venueCourtId, active);
  }
}
