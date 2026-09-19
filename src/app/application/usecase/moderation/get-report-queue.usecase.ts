import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ContentReport,
  ModerationPage,
  ModerationPageFilter
} from '@application/dto/moderation/moderation.dto';
import {
  SOCIAL_MODERATION_REPOSITORY_TOKEN,
  SocialModerationRepository
} from '@application/ports/persistence/social-moderation.repository';

@Injectable({ providedIn: 'root' })
export class GetReportQueueUseCase {
  constructor(
    @Inject(SOCIAL_MODERATION_REPOSITORY_TOKEN)
    private readonly repository: SocialModerationRepository
  ) { }

  execute(filter: ModerationPageFilter): Observable<ModerationPage<ContentReport>> {
    return this.repository.getReportQueue(filter);
  }
}
