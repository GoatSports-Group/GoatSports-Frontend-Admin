import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';
import { PageFilter } from '@application/dto/page.filter';

export interface OwnerApplicationRepository {
  getAllApplications(filter: PageFilter): Observable<OwnerApplication[]>;
  getApplicationDetail(id: string): Observable<OwnerApplication>;
  approve(id: string): Observable<OwnerApplication>;
  reject(id: string, rejectReason: string): Observable<OwnerApplication>;
  getFileUrl(key: string): Observable<string>;
}

export const OWNER_APPLICATION_REPOSITORY_TOKEN = new InjectionToken<OwnerApplicationRepository>('OwnerApplicationRepository');
