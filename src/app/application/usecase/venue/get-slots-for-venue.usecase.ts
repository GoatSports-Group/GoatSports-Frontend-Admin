import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeSlot } from '@application/dto/venue/venue.dto';

@Injectable({
  providedIn: 'root'
})
export class GetSlotsForVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) { }

  execute(venueId: string, dateStr: string): Observable<TimeSlot[]> {
    return this.venueRepository.getSlotsForVenue(venueId, dateStr);
  }
}
