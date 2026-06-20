import { BookingRepository, BOOKING_REPOSITORY_TOKEN } from '@application/ports/booking.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingStatus } from '@application/dto/booking/booking.dto';

@Injectable({
  providedIn: 'root'
})
export class UpdateBookingStatusUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY_TOKEN) private bookingRepository: BookingRepository
  ) {}

  execute(id: string, status: BookingStatus): Observable<boolean> {
    return this.bookingRepository.updateBookingStatus(id, status);
  }
}
