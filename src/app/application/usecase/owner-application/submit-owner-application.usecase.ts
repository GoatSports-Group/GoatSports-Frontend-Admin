import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OWNER_APPLICATION_REPOSITORY_TOKEN, OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';

@Injectable({ providedIn: 'root' })
export class SubmitOwnerApplicationUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private readonly repository: OwnerApplicationRepository
  ) { }

  execute(
    form: Record<string, unknown>,
    files: { idCardFront: File; idCardBack: File; businessLicense: File; venueImage: File }
  ): Observable<void> {
    return this.repository.submit(form, files);
  }
}
