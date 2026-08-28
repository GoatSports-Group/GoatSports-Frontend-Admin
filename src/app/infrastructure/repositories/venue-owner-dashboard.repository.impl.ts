import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VenueOwnerDashboardRepository } from '@application/ports/persistence/venue-owner-dashboard.repository';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { VenueOwnerDashboardApi } from '@infrastructure/api/venue-owner-dashboard.api';

@Injectable()
export class VenueOwnerDashboardRepositoryImpl implements VenueOwnerDashboardRepository {
  private readonly api = inject(VenueOwnerDashboardApi);

  getVenueOverview(venueId: string): Observable<OwnerVenueOverview> {
    return this.api.getVenueOverview(venueId).pipe(map(response => response.data));
  }
}
