export interface OwnerVenueCourt {
  venueCourtId: string;
  venueId: string;
  sportType: string;
  name: string;
  capacity: number;
  surfaceType: string;
  active: boolean;
}

export type SportType =
  | 'FOOTBALL'
  | 'BADMINTON'
  | 'TENNIS'
  | 'BASKETBALL'
  | 'PICKLEBALL'
  | 'VOLLEYBALL';

export interface OwnerVenueUpdate {
  name: string;
  description?: string;
  openTime: string;
  closeTime: string;
  active: boolean;
  minPrice: number;
  maxPrice: number;
  phone: string;
  email: string;
  address: string;
  ward?: string;
  district?: string;
  city: string;
  latitude?: number;
  longitude?: number;
  imageUrls: string[];
  amenities: string[];
}

export interface OwnerVenueCourtUpsert {
  name: string;
  sportType: SportType;
  capacity: number;
  surfaceType?: string;
  active: boolean;
}

export interface OwnerVenueOverview {
  venueId: string;
  name: string;
  description?: string;
  openTime?: string;
  closeTime?: string;
  active: boolean;
  minPrice?: number;
  maxPrice?: number;
  averageRating?: number;
  totalReviews?: number;
  phone?: string;
  email?: string;
  address?: string;
  ward?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  imageUrls: string[];
  amenities: string[];
  courts: OwnerVenueCourt[];
}
