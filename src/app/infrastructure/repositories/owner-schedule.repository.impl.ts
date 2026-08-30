import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CourtPricingRule,
  CourtPricingRuleUpsert,
  GenerateTimeSlotsRequest,
  OwnerTimeSlot,
  OwnerTimeSlotStatus
} from '@application/dto/owner-schedule/owner-schedule.dto';
import { OwnerScheduleRepository } from '@application/ports/persistence/owner-schedule.repository';
import { OwnerScheduleApi } from '@infrastructure/api/owner-schedule.api';

@Injectable()
export class OwnerScheduleRepositoryImpl implements OwnerScheduleRepository {
  private readonly api = inject(OwnerScheduleApi);

  getPricingRules(venueCourtId: string): Observable<CourtPricingRule[]> {
    return this.api.getPricingRules(venueCourtId).pipe(map(response => response.data ?? []));
  }

  createPricingRule(venueCourtId: string, request: CourtPricingRuleUpsert): Observable<CourtPricingRule> {
    return this.api.createPricingRule(venueCourtId, request).pipe(map(response => response.data));
  }

  updatePricingRule(
    venueCourtId: string, pricingRuleId: string, request: CourtPricingRuleUpsert
  ): Observable<CourtPricingRule> {
    return this.api.updatePricingRule(venueCourtId, pricingRuleId, request)
      .pipe(map(response => response.data));
  }

  deletePricingRule(venueCourtId: string, pricingRuleId: string): Observable<void> {
    return this.api.deletePricingRule(venueCourtId, pricingRuleId);
  }

  getTimeSlots(venueCourtId: string, fromDate: string, toDate: string): Observable<OwnerTimeSlot[]> {
    return this.api.getTimeSlots(venueCourtId, fromDate, toDate)
      .pipe(map(response => response.data ?? []));
  }

  generateTimeSlots(
    venueCourtId: string, request: GenerateTimeSlotsRequest
  ): Observable<OwnerTimeSlot[]> {
    return this.api.generateTimeSlots(venueCourtId, request)
      .pipe(map(response => response.data ?? []));
  }

  updateTimeSlotStatus(timeSlotId: string, status: OwnerTimeSlotStatus): Observable<OwnerTimeSlot> {
    return this.api.updateTimeSlotStatus(timeSlotId, status).pipe(map(response => response.data));
  }

  deleteTimeSlot(timeSlotId: string): Observable<void> {
    return this.api.deleteTimeSlot(timeSlotId);
  }
}
