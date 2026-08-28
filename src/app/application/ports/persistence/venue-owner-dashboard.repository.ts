import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';

export interface VenueOwnerDashboardRepository {
  getVenueOverview(venueId: string): Observable<OwnerVenueOverview>;
}

export const VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN =
  new InjectionToken<VenueOwnerDashboardRepository>('VenueOwnerDashboardRepository');
