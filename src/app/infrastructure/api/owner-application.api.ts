import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entity/owner-application';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@shared/utils/api.helper';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  getAllApplications(filter: PageFilter): Observable<BaseResponse<BaseListResponse<OwnerApplication>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<OwnerApplication>>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications`,
      { params }
    );
  }

  getApplicationDetail(id: string): Observable<BaseResponse<OwnerApplication>> {
    return this.http.get<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}`
    );
  }

  approve(id: string): Observable<BaseResponse<OwnerApplication>> {
    return this.http.post<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}/approve`,
      {}
    );
  }

  reject(id: string, rejectReason: string): Observable<BaseResponse<OwnerApplication>> {
    return this.http.post<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}/reject`,
      { rejectReason }
    );
  }

  getFileUrl(key: string): Observable<string> {
    return this.http.get(`${this.apiBase}/storage-service/api/v1/files`, {
      params: { key },
      responseType: 'text'
    });
  }
}
