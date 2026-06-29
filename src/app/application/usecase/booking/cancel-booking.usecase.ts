import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) { }

  execute(id: string): Observable<boolean> {
    return this.bookingRepository.cancelBooking(id);
  }
}
