import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CourtPricingRule,
  CourtPricingRuleUpsert,
  GenerateTimeSlotsRequest,
  OwnerTimeSlot,
  OwnerTimeSlotStatus
} from '@application/dto/owner-schedule/owner-schedule.dto';

export interface OwnerScheduleRepository {
  getPricingRules(venueCourtId: string): Observable<CourtPricingRule[]>;
  createPricingRule(venueCourtId: string, request: CourtPricingRuleUpsert): Observable<CourtPricingRule>;
  updatePricingRule(
    venueCourtId: string, pricingRuleId: string, request: CourtPricingRuleUpsert
  ): Observable<CourtPricingRule>;
  deletePricingRule(venueCourtId: string, pricingRuleId: string): Observable<void>;
  getTimeSlots(venueCourtId: string, fromDate: string, toDate: string): Observable<OwnerTimeSlot[]>;
  generateTimeSlots(venueCourtId: string, request: GenerateTimeSlotsRequest): Observable<OwnerTimeSlot[]>;
  updateTimeSlotStatus(timeSlotId: string, status: OwnerTimeSlotStatus): Observable<OwnerTimeSlot>;
  deleteTimeSlot(timeSlotId: string): Observable<void>;
}

export const OWNER_SCHEDULE_REPOSITORY_TOKEN =
  new InjectionToken<OwnerScheduleRepository>('OwnerScheduleRepository');
