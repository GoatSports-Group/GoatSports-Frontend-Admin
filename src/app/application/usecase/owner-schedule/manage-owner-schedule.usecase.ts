import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CourtPricingRule,
  CourtPricingRuleUpsert,
  GenerateTimeSlotsRequest,
  OwnerTimeSlot,
  OwnerTimeSlotStatus
} from '@application/dto/owner-schedule/owner-schedule.dto';
import {
  OWNER_SCHEDULE_REPOSITORY_TOKEN,
  OwnerScheduleRepository
} from '@application/ports/persistence/owner-schedule.repository';

@Injectable({ providedIn: 'root' })
export class ManageOwnerScheduleUseCase {
  constructor(
    @Inject(OWNER_SCHEDULE_REPOSITORY_TOKEN) private readonly repository: OwnerScheduleRepository
  ) { }

  listRules(courtId: string): Observable<CourtPricingRule[]> {
    return this.repository.getPricingRules(courtId);
  }

  createRule(courtId: string, request: CourtPricingRuleUpsert): Observable<CourtPricingRule> {
    return this.repository.createPricingRule(courtId, request);
  }

  updateRule(
    courtId: string, ruleId: string, request: CourtPricingRuleUpsert
  ): Observable<CourtPricingRule> {
    return this.repository.updatePricingRule(courtId, ruleId, request);
  }

  deleteRule(courtId: string, ruleId: string): Observable<void> {
    return this.repository.deletePricingRule(courtId, ruleId);
  }

  listSlots(courtId: string, fromDate: string, toDate: string): Observable<OwnerTimeSlot[]> {
    return this.repository.getTimeSlots(courtId, fromDate, toDate);
  }

  generateSlots(courtId: string, request: GenerateTimeSlotsRequest): Observable<OwnerTimeSlot[]> {
    return this.repository.generateTimeSlots(courtId, request);
  }

  setSlotStatus(slotId: string, status: OwnerTimeSlotStatus): Observable<OwnerTimeSlot> {
    return this.repository.updateTimeSlotStatus(slotId, status);
  }

  deleteSlot(slotId: string): Observable<void> {
    return this.repository.deleteTimeSlot(slotId);
  }
}
