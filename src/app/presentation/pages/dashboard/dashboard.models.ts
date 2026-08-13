import { OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';

export interface WeatherInfo {
  temp: number;
  condition: string;
  icon: string;
  description: string;
}

export interface VenueMapMarker {
  lat: number;
  lng: number;
  businessName: string;
  fullName: string;
  addressText: string;
  status: OwnerApplicationStatus;
  district: string;
  isFallback: boolean;
}

export interface DistrictBreakdownItem {
  name: string;
  count: number;
}

export interface CalendarGrid {
  days: number[];
  offsetCells: null[];
  currentDay: number;
}
