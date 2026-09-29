import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { AdminBookingFilter } from '@application/ports/persistence/admin-booking.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminBookingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/admin/bookings`;

  getBookings(filter: AdminBookingFilter): Observable<BaseResponse<BaseListResponse<OwnerBooking>>> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.query) params = params.set('query', filter.query);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get<BaseResponse<BaseListResponse<OwnerBooking>>>(this.baseUrl, { params });
  }

  getBooking(bookingId: string): Observable<BaseResponse<OwnerBooking>> {
    return this.http.get<BaseResponse<OwnerBooking>>(`${this.baseUrl}/${bookingId}`);
  }
}
