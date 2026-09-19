import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContentAppeal, ReviewAppealPayload } from '@application/dto/moderation/moderation.dto';
import {
  SOCIAL_MODERATION_REPOSITORY_TOKEN,
  SocialModerationRepository
} from '@application/ports/persistence/social-moderation.repository';

@Injectable({ providedIn: 'root' })
export class ReviewAppealUseCase {
  constructor(
    @Inject(SOCIAL_MODERATION_REPOSITORY_TOKEN)
    private readonly repository: SocialModerationRepository
  ) { }

  execute(payload: ReviewAppealPayload): Observable<ContentAppeal> {
    return this.repository.reviewAppeal(payload);
  }
}
