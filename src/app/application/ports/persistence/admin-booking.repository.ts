import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking, BookingCancellation, ProcessCancellationRequest } from '@application/dto/booking/booking.dto';
import { BaseResponse } from '@application/dto/base/base-response';

export interface AdminBookingRepository {
  getBookings(status?: string, page?: number, size?: number): Observable<BaseResponse<Booking[]>>;
  getBookingById(bookingId: string): Observable<BaseResponse<Booking>>;
  processCancellation(cancellationId: string, request: ProcessCancellationRequest): Observable<BaseResponse<BookingCancellation>>;
}

export const ADMIN_BOOKING_REPOSITORY_TOKEN = new InjectionToken<AdminBookingRepository>(
  'ADMIN_BOOKING_REPOSITORY_TOKEN'
);
