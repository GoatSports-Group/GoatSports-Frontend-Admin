import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ContentAppeal,
  ContentReport,
  ModerateContentPayload,
  ModerationPage,
  ModerationPageFilter,
  ModerationTarget,
  ReportTargetType,
  ReviewAppealPayload
} from '@application/dto/moderation/moderation.dto';
import { SocialModerationRepository } from '@application/ports/persistence/social-moderation.repository';
import { SocialModerationApi, SocialPageResponse } from '@infrastructure/api/social-moderation.api';

@Injectable()
export class SocialModerationRepositoryImpl implements SocialModerationRepository {
  private readonly api = inject(SocialModerationApi);

  getReportQueue(filter: ModerationPageFilter): Observable<ModerationPage<ContentReport>> {
    return this.api.getReportQueue(filter).pipe(map(response => toPage(response.data, filter)));
  }

  actOnReport(payload: ModerateContentPayload): Observable<ContentReport> {
    return this.api.actOnReport(payload).pipe(map(response => response.data));
  }

  getAppealQueue(filter: ModerationPageFilter): Observable<ModerationPage<ContentAppeal>> {
    return this.api.getAppealQueue(filter).pipe(map(response => toPage(response.data, filter)));
  }

  reviewAppeal(payload: ReviewAppealPayload): Observable<ContentAppeal> {
    return this.api.reviewAppeal(payload).pipe(map(response => response.data));
  }

  getTarget(targetType: ReportTargetType, targetId: string): Observable<ModerationTarget> {
    return this.api.getTarget(targetType, targetId).pipe(map(response => response.data));
  }
}

function toPage<T>(data: SocialPageResponse<T> | null, filter: ModerationPageFilter): ModerationPage<T> {
  return {
    items: data?.content ?? [],
    total: data?.totalElements ?? 0,
    page: data?.number ?? filter.page,
    pageSize: data?.size ?? filter.size,
    pages: data?.totalPages ?? 0
  };
}
