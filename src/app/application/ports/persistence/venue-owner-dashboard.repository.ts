import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerVenueCourt,
  OwnerVenueCourtUpsert,
  OwnerVenueOverview,
  OwnerVenueUpdate
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';

export interface VenueOwnerDashboardRepository {
  getVenueOverview(venueId: string): Observable<OwnerVenueOverview>;
  getMyVenue(): Observable<OwnerVenueOverview | null>;
  updateVenue(venueId: string, request: OwnerVenueUpdate): Observable<OwnerVenueOverview>;
  getVenueCourts(venueId: string): Observable<OwnerVenueCourt[]>;
  getVenueCourt(venueCourtId: string): Observable<OwnerVenueCourt>;
  createVenueCourt(venueId: string, request: OwnerVenueCourtUpsert): Observable<OwnerVenueCourt>;
  updateVenueCourt(venueCourtId: string, request: OwnerVenueCourtUpsert): Observable<OwnerVenueCourt>;
  updateVenueCourtActive(venueCourtId: string, active: boolean): Observable<OwnerVenueCourt>;
}

export const VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN =
  new InjectionToken<VenueOwnerDashboardRepository>('VenueOwnerDashboardRepository');
