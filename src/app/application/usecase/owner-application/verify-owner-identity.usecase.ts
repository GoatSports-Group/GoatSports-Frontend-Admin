import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OWNER_APPLICATION_REPOSITORY_TOKEN,
  OwnerApplicationFiles,
  OwnerApplicationRepository,
  PreparedOwnerIdentity
} from '@application/ports/persistence/owner-application.repository';

@Injectable({ providedIn: 'root' })
export class VerifyOwnerIdentityUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private readonly repository: OwnerApplicationRepository
  ) { }

  execute(files: OwnerApplicationFiles, livenessFrames: string[]): Observable<PreparedOwnerIdentity> {
    return this.repository.verifyIdentity(files, livenessFrames);
  }
}
