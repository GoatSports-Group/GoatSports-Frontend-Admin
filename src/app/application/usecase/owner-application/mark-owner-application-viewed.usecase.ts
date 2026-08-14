import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerApplicationRepository,
  OWNER_APPLICATION_REPOSITORY_TOKEN
} from '@application/ports/persistence/owner-application.repository';

@Injectable({
  providedIn: 'root'
})
export class MarkOwnerApplicationViewedUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private repository: OwnerApplicationRepository
  ) { }

  execute(id: string): Observable<void> {
    return this.repository.markViewed(id);
  }
}
