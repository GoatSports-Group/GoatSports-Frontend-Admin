import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ModerationTarget, ReportTargetType } from '@application/dto/moderation/moderation.dto';
import {
  SOCIAL_MODERATION_REPOSITORY_TOKEN,
  SocialModerationRepository
} from '@application/ports/persistence/social-moderation.repository';

@Injectable({ providedIn: 'root' })
export class GetModerationTargetUseCase {
  constructor(
    @Inject(SOCIAL_MODERATION_REPOSITORY_TOKEN)
    private readonly repository: SocialModerationRepository
  ) { }

  execute(targetType: ReportTargetType, targetId: string): Observable<ModerationTarget> {
    return this.repository.getTarget(targetType, targetId);
  }
}
