import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, BookingCancellation, ProcessCancellationRequest } from '@application/dto/booking/booking.dto';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminBookingApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getBookings(status?: string, page: number = 0, size: number = 20): Observable<BaseResponse<Booking[]>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }
    return this.http.get<BaseResponse<Booking[]>>(
      `${this.apiBase}/venue-service/api/v1/bookings/my-history`,
      { params }
    );
  }

  getBookingById(bookingId: string): Observable<BaseResponse<Booking>> {
    return this.http.get<BaseResponse<Booking>>(
      `${this.apiBase}/venue-service/api/v1/bookings/${bookingId}`
    );
  }

  processCancellation(cancellationId: string, request: ProcessCancellationRequest): Observable<BaseResponse<BookingCancellation>> {
    return this.http.post<BaseResponse<BookingCancellation>>(
      `${this.apiBase}/venue-service/api/v1/bookings/cancellations/${cancellationId}/process`,
      request
    );
  }
}
