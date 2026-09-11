import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entities/owner-application';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@infrastructure/api/build-page-params';
import { environment } from '@environments/environment';

export type OwnerApplicationDocumentSlot =
  | 'IDENTITY_FRONT'
  | 'IDENTITY_BACK'
  | 'BUSINESS_LICENSE'
  | 'VENUE_PHOTO';

export interface PrepareOwnerApplicationUploadRequest {
  documents: Array<{
    slot: OwnerApplicationDocumentSlot;
    fileName: string;
    contentType: string;
  }>;
}

export interface PreparedOwnerApplicationUploadResponse {
  ownerApplicationId: string;
  documents: Array<{
    slot: OwnerApplicationDocumentSlot;
    uploadUrl: string;
    objectKey: string;
  }>;
}

export interface SubmitOwnerApplicationRequest extends Record<string, unknown> {
  ownerApplicationId: string;
  documents: Array<{
    slot: OwnerApplicationDocumentSlot;
    objectKey: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private uploadHttp = new HttpClient(inject(HttpBackend));
  private apiBase = environment.apiUrl;

  prepareUploads(
    request: PrepareOwnerApplicationUploadRequest,
    idempotencyKey: string
  ): Observable<BaseResponse<PreparedOwnerApplicationUploadResponse>> {
    return this.http.post<BaseResponse<PreparedOwnerApplicationUploadResponse>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/uploads`,
      request,
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
  }

  upload(uploadUrl: string, file: File): Observable<void> {
    return this.uploadHttp.put<void>(uploadUrl, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' }
    });
  }

  submitApplication(
    request: SubmitOwnerApplicationRequest
  ): Observable<BaseResponse<OwnerApplication>> {
    return this.http.post<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications`,
      request
    );
  }

  cleanupUploads(ownerApplicationId: string, objectKeys: string[]): Observable<void> {
    return this.http.post<void>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/uploads/cleanup`,
      { ownerApplicationId, objectKeys }
    );
  }

  getAllApplications(filter: PageFilter): Observable<BaseResponse<BaseListResponse<OwnerApplication>>> {
    return this.http.get<BaseResponse<BaseListResponse<OwnerApplication>>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications`,
      { params: buildPageParams(filter) }
    );
  }

  getMyApplications(filter?: PageFilter): Observable<BaseResponse<BaseListResponse<OwnerApplication>>> {
    return this.http.get<BaseResponse<BaseListResponse<OwnerApplication>>>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/me`,
      { params: buildPageParams(filter || { page: 0, size: 20 }) }
    );
  }

  getApplicationDetail(id: string): Observable<BaseResponse<OwnerApplication>> {
    return this.http.get<BaseResponse<OwnerApplication>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}`
    );
  }

  markViewed(id: string): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}/viewed`,
      {}
    );
  }

  approve(id: string): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}/approve`,
      {}
    );
  }

  reject(id: string, rejectReason: string): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(
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
