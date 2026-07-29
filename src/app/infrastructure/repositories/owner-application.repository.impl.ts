import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import { OwnerApplicationApi } from '@infrastructure/api/owner-application.api';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);

  getAllApplications(filter: PageFilter): Observable<BaseListResponse<OwnerApplication>> {
    return this.ownerApplicationApi.getAllApplications(filter).pipe(
      map(response => response.data)
    );
  }

  getApplicationDetail(id: string): Observable<OwnerApplication> {
    return this.ownerApplicationApi.getApplicationDetail(id).pipe(
      map(response => response.data)
    );
  }

  approve(id: string): Observable<void> {
    return this.ownerApplicationApi.approve(id).pipe(
      map(() => undefined)
    );
  }

  reject(id: string, rejectReason: string): Observable<void> {
    return this.ownerApplicationApi.reject(id, rejectReason).pipe(
      map(() => undefined)
    );
  }

  getFileUrl(key: string): Observable<string> {
    return this.ownerApplicationApi.getFileUrl(key);
  }
}
