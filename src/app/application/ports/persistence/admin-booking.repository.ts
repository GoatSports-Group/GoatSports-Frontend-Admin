import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerBooking, OwnerBookingPage, OwnerBookingStatus } from '@application/dto/owner-booking/owner-booking.dto';

/** Bộ lọc đơn đặt sân toàn nền tảng (admin). `query` tìm theo mã đơn, tên/số điện thoại khách tại quầy, tên cơ sở. */
export interface AdminBookingFilter {
  status?: OwnerBookingStatus;
  query?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  size: number;
}

export interface AdminBookingRepository {
  getBookings(filter: AdminBookingFilter): Observable<OwnerBookingPage>;
  getBooking(bookingId: string): Observable<OwnerBooking>;
}

export const ADMIN_BOOKING_REPOSITORY_TOKEN = new InjectionToken<AdminBookingRepository>(
  'ADMIN_BOOKING_REPOSITORY_TOKEN'
);
