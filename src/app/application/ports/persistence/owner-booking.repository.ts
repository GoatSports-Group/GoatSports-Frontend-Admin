import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerBooking,
  OwnerBookingFilter,
  OwnerBookingPage,
  OwnerBookingStatus,
  CreateOwnerWalkInBooking,
  OwnerBookingPaymentMethod,
  OwnerBookingPaymentResult,
  OwnerBookingReportFilter
} from '@application/dto/owner-booking/owner-booking.dto';

export interface OwnerBookingRepository {
  getBookings(filter: OwnerBookingFilter): Observable<OwnerBookingPage>;
  getBooking(bookingId: string): Observable<OwnerBooking>;
  updateStatus(bookingId: string, status: OwnerBookingStatus): Observable<OwnerBooking>;
  createWalkIn(request: CreateOwnerWalkInBooking): Observable<OwnerBooking>;
  createPayment(
    bookingId: string, method: OwnerBookingPaymentMethod
  ): Observable<OwnerBookingPaymentResult>;
  exportReport(filter: OwnerBookingReportFilter): Observable<Blob>;
  previewReport(filter: OwnerBookingReportFilter): Observable<Blob>;
}

export const OWNER_BOOKING_REPOSITORY_TOKEN = new InjectionToken<OwnerBookingRepository>(
  'OWNER_BOOKING_REPOSITORY_TOKEN'
);
