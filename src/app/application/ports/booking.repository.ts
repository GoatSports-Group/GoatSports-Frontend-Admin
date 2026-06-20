import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking, BookingStatus } from '@application/dto/booking/booking.dto';

export interface BookingRepository {
  getMyBookings(email: string): Observable<Booking[]>;
  getAllBookings(): Observable<Booking[]>;
  createBooking(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking>;
  cancelBooking(id: string): Observable<boolean>;
  updateBookingStatus(id: string, status: BookingStatus): Observable<boolean>;
  getStats(): Observable<{ totalVenues: number; totalBookings: number; totalRevenue: number; bookingsToday: number }>;
}

export const BOOKING_REPOSITORY_TOKEN = new InjectionToken<BookingRepository>('BookingRepository');
