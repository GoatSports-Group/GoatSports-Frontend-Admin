import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AdminBookingFilter, AdminBookingRepository } from '@application/ports/persistence/admin-booking.repository';
import { OwnerBooking, OwnerBookingPage } from '@application/dto/owner-booking/owner-booking.dto';
import { AdminBookingApi } from '@infrastructure/api/admin-booking.api';

@Injectable({ providedIn: 'root' })
export class AdminBookingRepositoryImpl implements AdminBookingRepository {
  private readonly api = inject(AdminBookingApi);

  getBookings(filter: AdminBookingFilter): Observable<OwnerBookingPage> {
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
}
