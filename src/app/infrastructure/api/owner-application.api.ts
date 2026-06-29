import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OwnerApplication } from '@domain/entity/owner-application';

export interface OwnerApplicationListResponse {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: OwnerApplication[];
}

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationApi {
  private http = inject(HttpClient);
  private apiBase = import.meta.env.NG_APP_API_URL;

  submit(formData: FormData): Observable<OwnerApplication> {
    return this.http.post<OwnerApplication>(
      `${this.apiBase}/venue-service/api/v1/owner-applications`,
      formData
    );
  }

  getMyApplications(): Observable<OwnerApplicationListResponse> {
    return this.http.get<OwnerApplicationListResponse>(
      `${this.apiBase}/venue-service/api/v1/owner-applications/me`
    );
  }

  getAllApplications(): Observable<OwnerApplicationListResponse> {
    return this.http.get<OwnerApplicationListResponse>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications`
    );
  }

  getApplicationDetail(id: string): Observable<OwnerApplication> {
    return this.http.get<OwnerApplication>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}`
    );
  }

  approve(id: string): Observable<OwnerApplication> {
    return this.http.post<OwnerApplication>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}/approve`,
      {}
    );
  }

  reject(id: string, rejectReason: string): Observable<OwnerApplication> {
    return this.http.post<OwnerApplication>(
      `${this.apiBase}/venue-service/api/v1/admin/owner-applications/${id}/reject`,
      { rejectReason }
    );
  }
}
