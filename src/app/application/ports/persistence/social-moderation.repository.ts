import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ContentAppeal,
  ContentReport,
  ModerateContentPayload,
  ModerationPage,
  ModerationPageFilter,
  ReviewAppealPayload
} from '@application/dto/moderation/moderation.dto';

export interface SocialModerationRepository {
  getReportQueue(filter: ModerationPageFilter): Observable<ModerationPage<ContentReport>>;
  actOnReport(payload: ModerateContentPayload): Observable<ContentReport>;
  getAppealQueue(filter: ModerationPageFilter): Observable<ModerationPage<ContentAppeal>>;
  reviewAppeal(payload: ReviewAppealPayload): Observable<ContentAppeal>;
}

export const SOCIAL_MODERATION_REPOSITORY_TOKEN = new InjectionToken<SocialModerationRepository>(
  'SOCIAL_MODERATION_REPOSITORY_TOKEN'
);
