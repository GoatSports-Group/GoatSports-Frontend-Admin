import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  OwnerBooking,
  OwnerBookingFilter,
  OwnerBookingPage,
  OwnerBookingStatus,
  CreateOwnerWalkInBooking,
  OwnerBookingPaymentMethod,
  OwnerBookingPaymentResult
} from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerBookingRepository } from '@application/ports/persistence/owner-booking.repository';
import { OwnerBookingApi } from '@infrastructure/api/owner-booking.api';

@Injectable()
export class OwnerBookingRepositoryImpl implements OwnerBookingRepository {
  private readonly api = inject(OwnerBookingApi);

  getBookings(filter: OwnerBookingFilter): Observable<OwnerBookingPage> {
    return this.api.getBookings(filter).pipe(map(response => ({
      items: response.data?.result ?? [],
      page: response.data?.meta.page ?? filter.page,
      pageSize: response.data?.meta.pageSize ?? filter.size,
      pages: response.data?.meta.pages ?? 0,
      total: response.data?.meta.total ?? 0
    })));
  }

  getBooking(bookingId: string): Observable<OwnerBooking> {
    return this.api.getBooking(bookingId).pipe(map(response => response.data));
  }

  updateStatus(bookingId: string, status: OwnerBookingStatus): Observable<OwnerBooking> {
    return this.api.updateStatus(bookingId, status).pipe(map(response => response.data));
  }

  createWalkIn(request: CreateOwnerWalkInBooking): Observable<OwnerBooking> {
    return this.api.createWalkIn(request).pipe(map(response => response.data.booking));
  }

  createPayment(
    bookingId: string, method: OwnerBookingPaymentMethod
  ): Observable<OwnerBookingPaymentResult> {
    return this.api.createPayment(bookingId, method).pipe(map(response => response.data));
  }

  confirmVietQrPayment(bookingId: string): Observable<OwnerBookingPaymentResult> {
    return this.api.confirmVietQrPayment(bookingId).pipe(map(response => response.data));
  }
}
