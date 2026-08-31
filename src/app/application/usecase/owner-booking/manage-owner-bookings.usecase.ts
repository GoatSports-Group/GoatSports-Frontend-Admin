import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerBooking,
  OwnerBookingFilter,
  OwnerBookingPage,
  OwnerBookingStatus,
  CreateOwnerWalkInBooking,
  OwnerBookingPaymentMethod,
  OwnerBookingPaymentResult
} from '@application/dto/owner-booking/owner-booking.dto';
import {
  OWNER_BOOKING_REPOSITORY_TOKEN,
  OwnerBookingRepository
} from '@application/ports/persistence/owner-booking.repository';

@Injectable({ providedIn: 'root' })
export class ManageOwnerBookingsUseCase {
  constructor(
    @Inject(OWNER_BOOKING_REPOSITORY_TOKEN) private readonly repository: OwnerBookingRepository
  ) { }

  list(filter: OwnerBookingFilter): Observable<OwnerBookingPage> {
    return this.repository.getBookings(filter);
  }

  detail(bookingId: string): Observable<OwnerBooking> {
    return this.repository.getBooking(bookingId);
  }

  updateStatus(bookingId: string, status: OwnerBookingStatus): Observable<OwnerBooking> {
    return this.repository.updateStatus(bookingId, status);
  }

  createWalkIn(request: CreateOwnerWalkInBooking): Observable<OwnerBooking> {
    return this.repository.createWalkIn(request);
  }

  createPayment(
    bookingId: string, method: OwnerBookingPaymentMethod
  ): Observable<OwnerBookingPaymentResult> {
    return this.repository.createPayment(bookingId, method);
  }
}
