import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class VenueOwnerDashboardApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  getVenueOverview(venueId: string): Observable<BaseResponse<OwnerVenueOverview>> {
    return this.http.get<BaseResponse<OwnerVenueOverview>>(
      `${this.apiBase}/venue-service/api/v1/venues/${venueId}/details`
    );
  }
}
