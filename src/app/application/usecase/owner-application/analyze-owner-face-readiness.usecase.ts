import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OWNER_APPLICATION_REPOSITORY_TOKEN,
  OwnerApplicationRepository,
  OwnerFaceReadiness
} from '@application/ports/persistence/owner-application.repository';

@Injectable({ providedIn: 'root' })
export class AnalyzeOwnerFaceReadinessUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private readonly repository: OwnerApplicationRepository
  ) { }

  execute(frame: string): Observable<OwnerFaceReadiness> {
    return this.repository.analyzeFaceReadiness(frame);
  }
}
