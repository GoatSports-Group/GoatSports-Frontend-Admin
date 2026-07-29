import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

export interface OwnerApplicationRepository {
  getAllApplications(filter: PageFilter): Observable<BaseListResponse<OwnerApplication>>;
  getApplicationDetail(id: string): Observable<OwnerApplication>;
  approve(id: string): Observable<void>;
  reject(id: string, rejectReason: string): Observable<void>;
  getFileUrl(key: string): Observable<string>;
}

export const OWNER_APPLICATION_REPOSITORY_TOKEN = new InjectionToken<OwnerApplicationRepository>('OwnerApplicationRepository');
