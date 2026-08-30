import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  CourtPricingRule,
  CourtPricingRuleUpsert,
  GenerateTimeSlotsRequest,
  OwnerTimeSlot,
  OwnerTimeSlotStatus
} from '@application/dto/owner-schedule/owner-schedule.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class OwnerScheduleApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/owner`;

  getPricingRules(venueCourtId: string): Observable<BaseResponse<CourtPricingRule[]>> {
    return this.http.get<BaseResponse<CourtPricingRule[]>>(
      `${this.baseUrl}/venue-courts/${venueCourtId}/pricing-rules`
    );
  }

  createPricingRule(
    venueCourtId: string, request: CourtPricingRuleUpsert
  ): Observable<BaseResponse<CourtPricingRule>> {
    return this.http.post<BaseResponse<CourtPricingRule>>(
      `${this.baseUrl}/venue-courts/${venueCourtId}/pricing-rules`, request
    );
  }

  updatePricingRule(
    venueCourtId: string, pricingRuleId: string, request: CourtPricingRuleUpsert
  ): Observable<BaseResponse<CourtPricingRule>> {
    return this.http.put<BaseResponse<CourtPricingRule>>(
      `${this.baseUrl}/venue-courts/${venueCourtId}/pricing-rules/${pricingRuleId}`, request
    );
  }

  deletePricingRule(venueCourtId: string, pricingRuleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/venue-courts/${venueCourtId}/pricing-rules/${pricingRuleId}`
    );
  }

  getTimeSlots(
    venueCourtId: string, fromDate: string, toDate: string
  ): Observable<BaseResponse<OwnerTimeSlot[]>> {
    const params = new HttpParams().set('fromDate', fromDate).set('toDate', toDate);
    return this.http.get<BaseResponse<OwnerTimeSlot[]>>(
      `${this.baseUrl}/venue-courts/${venueCourtId}/time-slots`, { params }
    );
  }

  generateTimeSlots(
    venueCourtId: string, request: GenerateTimeSlotsRequest
  ): Observable<BaseResponse<OwnerTimeSlot[]>> {
    return this.http.post<BaseResponse<OwnerTimeSlot[]>>(
      `${this.baseUrl}/venue-courts/${venueCourtId}/time-slots`, request
    );
  }

  updateTimeSlotStatus(
    timeSlotId: string, status: OwnerTimeSlotStatus
  ): Observable<BaseResponse<OwnerTimeSlot>> {
    return this.http.patch<BaseResponse<OwnerTimeSlot>>(
      `${this.baseUrl}/time-slots/${timeSlotId}`, { status }
    );
  }

  deleteTimeSlot(timeSlotId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/time-slots/${timeSlotId}`);
  }
}
