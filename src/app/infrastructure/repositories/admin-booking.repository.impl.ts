import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminBookingRepository } from '@application/ports/persistence/admin-booking.repository';
import { AdminBookingApi } from '@infrastructure/api/admin-booking.api';
import { Booking, BookingCancellation, ProcessCancellationRequest } from '@application/dto/booking/booking.dto';
import { BaseResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class AdminBookingRepositoryImpl implements AdminBookingRepository {
  private api = inject(AdminBookingApi);

  getBookings(status?: string, page?: number, size?: number): Observable<BaseResponse<Booking[]>> {
    return this.api.getBookings(status, page, size);
  }

  getBookingById(bookingId: string): Observable<BaseResponse<Booking>> {
    return this.api.getBookingById(bookingId);
  }

  processCancellation(cancellationId: string, request: ProcessCancellationRequest): Observable<BaseResponse<BookingCancellation>> {
    return this.api.processCancellation(cancellationId, request);
  }
}
