import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  ContentAppeal,
  ContentReport,
  ModerateContentPayload,
  ModerationPageFilter,
  ModerationTarget,
  ReportTargetType,
  ReviewAppealPayload
} from '@application/dto/moderation/moderation.dto';
import { environment } from '@environments/environment';

/** social-service tra ve Spring Page da phang hoa, khac shape meta/result cua venue-service. */
export interface SocialPageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class SocialModerationApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/social-service/api/v1/admin/social`;

  getReportQueue(filter: ModerationPageFilter): Observable<BaseResponse<SocialPageResponse<ContentReport>>> {
    return this.http.get<BaseResponse<SocialPageResponse<ContentReport>>>(
      `${this.baseUrl}/reports`,
      { params: this.pageParams(filter) }
    );
  }

  actOnReport(payload: ModerateContentPayload): Observable<BaseResponse<ContentReport>> {
    return this.http.patch<BaseResponse<ContentReport>>(
      `${this.baseUrl}/reports/${payload.reportId}/action`,
      { actionType: payload.actionType, reason: payload.reason }
    );
  }

  getAppealQueue(filter: ModerationPageFilter): Observable<BaseResponse<SocialPageResponse<ContentAppeal>>> {
    return this.http.get<BaseResponse<SocialPageResponse<ContentAppeal>>>(
      `${this.baseUrl}/appeals`,
      { params: this.pageParams(filter) }
    );
  }

  reviewAppeal(payload: ReviewAppealPayload): Observable<BaseResponse<ContentAppeal>> {
    return this.http.patch<BaseResponse<ContentAppeal>>(
      `${this.baseUrl}/appeals/${payload.appealId}`,
      { decision: payload.decision }
    );
  }

  getTarget(targetType: ReportTargetType, targetId: string): Observable<BaseResponse<ModerationTarget>> {
    return this.http.get<BaseResponse<ModerationTarget>>(`${this.baseUrl}/targets/${targetType}/${targetId}`);
  }

  private pageParams(filter: ModerationPageFilter): HttpParams {
    // social-service đọc page tính từ 1; filter.page tính từ 0.
    let params = new HttpParams().set('page', filter.page + 1).set('size', filter.size);
    for (const status of filter.status ?? []) params = params.append('status', status);
    return params;
  }
}
