export type ScheduleDayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type OwnerTimeSlotStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'MAINTENANCE';

export interface CourtPricingRule {
  pricingRuleId: string;
  courtId: string;
  dayOfWeek: ScheduleDayOfWeek;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  basePricePerHour: number;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface CourtPricingRuleUpsert {
  dayOfWeek: ScheduleDayOfWeek;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  basePricePerHour: number;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface OwnerTimeSlot {
  timeSlotId: string;
  venueCourtId: string;
  date: string;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  status: OwnerTimeSlotStatus;
}

export interface GenerateTimeSlotsRequest {
  fromDate: string;
  toDate: string;
  pricingRuleIds: string[];
  slotDurationMinutes: number;
}
