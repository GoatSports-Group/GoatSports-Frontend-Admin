import { SportType, SPORT_TYPE_OPTIONS } from '@domain/enums/sport-type.enum';
import { VenueStatus, VENUE_STATUS_OPTIONS } from '@domain/enums/venue-status.enum';

export { Venue, TimeSlot } from '@domain/entity/venue';
export { SportType, SPORT_TYPE_OPTIONS, VenueStatus, VENUE_STATUS_OPTIONS };

export interface VenueFilter {
  sportType?: string;
  minPrice?: number;
  maxPrice?: number;
  area?: string;
  rating?: number;
  timeSlot?: string;
  searchTerm?: string;
}

export type VenueSort = 'price-asc' | 'price-desc' | 'rating-desc' | 'name-asc';
