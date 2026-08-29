import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VenueOwnerDashboardRepository } from '@application/ports/persistence/venue-owner-dashboard.repository';
import {
  OwnerVenueCourt,
  OwnerVenueCourtUpsert,
  OwnerVenueOverview,
  OwnerVenueUpdate
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { VenueOwnerDashboardApi } from '@infrastructure/api/venue-owner-dashboard.api';

@Injectable()
export class VenueOwnerDashboardRepositoryImpl implements VenueOwnerDashboardRepository {
  private readonly api = inject(VenueOwnerDashboardApi);

  getVenueOverview(venueId: string): Observable<OwnerVenueOverview> {
    return this.api.getVenueOverview(venueId).pipe(map(response => response.data));
  }

  getMyVenues(): Observable<OwnerVenueOverview[]> {
    return this.api.getMyVenues().pipe(map(response => response.data ?? []));
  }

  getMyVenue(): Observable<OwnerVenueOverview | null> {
    return this.getMyVenues().pipe(map(venues => venues[0] ?? null));
  }

  updateVenue(venueId: string, request: OwnerVenueUpdate): Observable<OwnerVenueOverview> {
    return this.api.updateVenue(venueId, request).pipe(map(response => response.data));
  }

  getVenueCourts(venueId: string): Observable<OwnerVenueCourt[]> {
    return this.api.getVenueCourts(venueId).pipe(map(response => response.data ?? []));
  }

  getVenueCourt(venueCourtId: string): Observable<OwnerVenueCourt> {
    return this.api.getVenueCourt(venueCourtId).pipe(map(response => response.data));
  }

  createVenueCourt(venueId: string, request: OwnerVenueCourtUpsert): Observable<OwnerVenueCourt> {
    return this.api.createVenueCourt(venueId, request).pipe(map(response => response.data));
  }

  updateVenueCourt(venueCourtId: string, request: OwnerVenueCourtUpsert): Observable<OwnerVenueCourt> {
    return this.api.updateVenueCourt(venueCourtId, request).pipe(map(response => response.data));
  }

  updateVenueCourtActive(venueCourtId: string, active: boolean): Observable<OwnerVenueCourt> {
    return this.api.updateVenueCourtActive(venueCourtId, active).pipe(map(response => response.data));
  }
}
