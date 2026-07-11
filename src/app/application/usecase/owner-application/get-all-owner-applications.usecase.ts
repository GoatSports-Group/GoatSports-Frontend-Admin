import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplicationRepository, OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class GetAllOwnerApplicationsUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private repository: OwnerApplicationRepository
  ) { }

  execute(filter: PageFilter): Observable<OwnerApplication[]> {
    return this.repository.getAllApplications(filter);
  }
}
