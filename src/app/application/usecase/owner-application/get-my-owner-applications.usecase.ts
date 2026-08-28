import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplicationRepository, OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class GetMyOwnerApplicationsUseCase {
  constructor(
    @Inject(OWNER_APPLICATION_REPOSITORY_TOKEN) private repository: OwnerApplicationRepository
  ) { }

  execute(filter?: PageFilter): Observable<BaseListResponse<OwnerApplication>> {
    return this.repository.getMyApplications(filter);
  }
}
