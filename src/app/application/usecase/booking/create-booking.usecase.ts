import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking } from '@application/dto/booking/booking.dto';

@Injectable({
  providedIn: 'root'
})
export class CreateBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) { }

  execute(bookingData: Omit<Booking, 'bookingId' | 'status' | 'createdAt'>): Observable<Booking> {
    return this.bookingRepository.createBooking(bookingData);
  }
}
