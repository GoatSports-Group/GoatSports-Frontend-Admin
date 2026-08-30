import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import {
  ConfirmOwnerCheckIn,
  CreateWalkInBooking,
  OwnerCheckInFilter,
  OwnerCheckInLookup,
  OwnerCheckInResult
} from '@application/dto/owner-check-in/owner-check-in.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class OwnerCheckInApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/owner/check-ins`;

  lookup(request: OwnerCheckInLookup): Observable<BaseResponse<OwnerCheckInResult>> {
    return this.http.post<BaseResponse<OwnerCheckInResult>>(`${this.baseUrl}/lookup`, request);
  }

  confirm(request: ConfirmOwnerCheckIn): Observable<BaseResponse<OwnerCheckInResult>> {
    return this.http.post<BaseResponse<OwnerCheckInResult>>(this.baseUrl, request);
  }

  createWalkIn(request: CreateWalkInBooking): Observable<BaseResponse<OwnerCheckInResult>> {
    return this.http.post<BaseResponse<OwnerCheckInResult>>(`${this.baseUrl}/walk-ins`, request);
  }

  history(filter: OwnerCheckInFilter): Observable<BaseResponse<BaseListResponse<OwnerCheckInResult>>> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.venueId) params = params.set('venueId', filter.venueId);
    if (filter.venueCourtId) params = params.set('venueCourtId', filter.venueCourtId);
    if (filter.date) params = params.set('date', filter.date);
    return this.http.get<BaseResponse<BaseListResponse<OwnerCheckInResult>>>(this.baseUrl, { params });
  }
}
