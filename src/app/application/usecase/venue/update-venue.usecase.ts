import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Venue } from '@application/dto/venue/venue.dto';

@Injectable({
  providedIn: 'root'
})
export class UpdateVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) { }

  execute(venue: Venue): Observable<Venue> {
    return this.venueRepository.updateVenue(venue);
  }
}
