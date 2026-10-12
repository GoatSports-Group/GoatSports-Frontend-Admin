import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerBooking, OwnerBookingPage, OwnerBookingStatus } from '@application/dto/owner-booking/owner-booking.dto';

/** Bộ lọc đơn đặt sân toàn nền tảng (admin). `query` tìm theo mã đơn, tên/số điện thoại khách tại quầy, tên cơ sở. */
export interface AdminBookingFilter {
  venueId?: string;
  venueCourtId?: string;
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
  /** Báo cáo theo bộ lọc hiện tại (bỏ qua trang), tối đa 10.000 đơn. */
  exportReport(filter: Omit<AdminBookingFilter, 'page' | 'size'>, format: 'xlsx' | 'pdf'): Observable<Blob>;
  /** Bản PDF xem trước của đúng báo cáo trên (cũng là file PDF tải về). */
  previewReport(filter: Omit<AdminBookingFilter, 'page' | 'size'>): Observable<Blob>;
}

export const ADMIN_BOOKING_REPOSITORY_TOKEN = new InjectionToken<AdminBookingRepository>(
  'ADMIN_BOOKING_REPOSITORY_TOKEN'
);
