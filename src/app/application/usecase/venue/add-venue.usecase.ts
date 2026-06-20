import { VenueRepository, VENUE_REPOSITORY_TOKEN } from '@application/ports/venue.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Venue } from '@application/dto/venue/venue.dto';

@Injectable({
  providedIn: 'root'
})
export class AddVenueUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY_TOKEN) private venueRepository: VenueRepository
  ) {}

  execute(venue: Omit<Venue, 'venueId' | 'rating'>): Observable<Venue> {
    return this.venueRepository.addVenue(venue);
  }
}
