import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  OwnerVenueCourt,
  OwnerVenueCourtUpsert,
  OwnerVenueOverview,
  OwnerVenueUpdate
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class VenueOwnerDashboardApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  getVenueOverview(venueId: string): Observable<BaseResponse<OwnerVenueOverview>> {
    return this.http.get<BaseResponse<OwnerVenueOverview>>(
      `${this.apiBase}/venue-service/api/v1/owner/venues/${venueId}`
    );
  }

  getMyVenue(): Observable<BaseResponse<OwnerVenueOverview[]>> {
    return this.http.get<BaseResponse<OwnerVenueOverview[]>>(
      `${this.apiBase}/venue-service/api/v1/owner/venues`
    );
  }

  updateVenue(venueId: string, request: OwnerVenueUpdate): Observable<BaseResponse<OwnerVenueOverview>> {
    return this.http.put<BaseResponse<OwnerVenueOverview>>(
      `${this.apiBase}/venue-service/api/v1/owner/venues/${venueId}`,
      request
    );
  }

  getVenueCourts(venueId: string): Observable<BaseResponse<OwnerVenueCourt[]>> {
    return this.http.get<BaseResponse<OwnerVenueCourt[]>>(
      `${this.apiBase}/venue-service/api/v1/owner/venues/${venueId}/courts`
    );
  }

  getVenueCourt(venueCourtId: string): Observable<BaseResponse<OwnerVenueCourt>> {
    return this.http.get<BaseResponse<OwnerVenueCourt>>(
      `${this.apiBase}/venue-service/api/v1/owner/venue-courts/${venueCourtId}`
    );
  }

  createVenueCourt(
    venueId: string,
    request: OwnerVenueCourtUpsert
  ): Observable<BaseResponse<OwnerVenueCourt>> {
    return this.http.post<BaseResponse<OwnerVenueCourt>>(
      `${this.apiBase}/venue-service/api/v1/owner/venues/${venueId}/courts`,
      request
    );
  }

  updateVenueCourt(
    venueCourtId: string,
    request: OwnerVenueCourtUpsert
  ): Observable<BaseResponse<OwnerVenueCourt>> {
    return this.http.put<BaseResponse<OwnerVenueCourt>>(
      `${this.apiBase}/venue-service/api/v1/owner/venue-courts/${venueCourtId}`,
      request
    );
  }

  updateVenueCourtActive(
    venueCourtId: string,
    active: boolean
  ): Observable<BaseResponse<OwnerVenueCourt>> {
    return this.http.patch<BaseResponse<OwnerVenueCourt>>(
      `${this.apiBase}/venue-service/api/v1/owner/venue-courts/${venueCourtId}`,
      { active }
    );
  }
}
