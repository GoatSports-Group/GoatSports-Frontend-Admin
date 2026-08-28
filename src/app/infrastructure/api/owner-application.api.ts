import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@infrastructure/api/build-page-params';
import { environment } from "@environments/environment"

export type OwnerApplicationProgressItem = {
  ownerApplicationId: string;
  receivedAt?: string;
  viewedAt?: string;
};

export type OwnerApplicationProgressResponse = {
  items: OwnerApplicationProgressItem[];
};

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getAllApplications(filter: PageFilter): Observable<BaseResponse<BaseListResponse<OwnerApplication>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<OwnerApplication>>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications`,
      { params }
    );
  }

  getMyApplications(filter?: PageFilter): Observable<BaseResponse<BaseListResponse<OwnerApplication>>> {
    const params = buildPageParams(filter || { page: 0, size: 20 });
    return this.http.get<BaseResponse<BaseListResponse<OwnerApplication>>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/me`,
      { params }
    );
  }

  getMyApplicationProgress(ownerApplicationIds: string[]): Observable<BaseResponse<OwnerApplicationProgressResponse>> {
    return this.http.post<BaseResponse<OwnerApplicationProgressResponse>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/owner-applications/my/progress/search`,
      { ownerApplicationIds }
    );
  }

  getApplicationDetail(id: string): Observable<BaseResponse<OwnerApplication>> {
    return this.http.get<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}`
    );
  }

  markViewed(id: string): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/owner-applications/${id}/viewed`,
      {}
    );
  }

  approve(id: string): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/owner-applications/${id}/complete-review`,
      { approved: true }
    );
  }

  reject(id: string, rejectReason: string): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(
      `${this.apiBase}/workflow-service/api/v1/workflows/owner-applications/${id}/complete-review`,
      { approved: false, rejectReason }
    );
  }

  getFileUrl(key: string): Observable<string> {
    return this.http.get(`${this.apiBase}/storage-service/api/v1/files`, {
      params: { key },
      responseType: 'text'
    });
  }
}
