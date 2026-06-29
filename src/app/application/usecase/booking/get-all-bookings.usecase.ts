import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking } from '@application/dto/booking/booking.dto';

@Injectable({
  providedIn: 'root'
})
export class GetAllBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) { }

  execute(): Observable<Booking[]> {
    return this.bookingRepository.getAllBookings();
  }
}
