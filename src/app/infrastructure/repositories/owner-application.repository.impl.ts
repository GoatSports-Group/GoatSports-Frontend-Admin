import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entity/owner-application';
import { OwnerApplicationApi } from '@infrastructure/api/owner-application.api';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);

  getAllApplications(filter: PageFilter): Observable<OwnerApplication[]> {
    return this.ownerApplicationApi.getAllApplications(filter).pipe(
      map(response => response.data?.result || [])
    );
  }

  getApplicationDetail(id: string): Observable<OwnerApplication> {
    return this.ownerApplicationApi.getApplicationDetail(id).pipe(
      map(response => response.data)
    );
  }

  approve(id: string): Observable<OwnerApplication> {
    return this.ownerApplicationApi.approve(id).pipe(
      map(response => response.data)
    );
  }

  reject(id: string, rejectReason: string): Observable<OwnerApplication> {
    return this.ownerApplicationApi.reject(id, rejectReason).pipe(
      map(response => response.data)
    );
  }

  getFileUrl(key: string): Observable<string> {
    return this.ownerApplicationApi.getFileUrl(key);
  }
}
