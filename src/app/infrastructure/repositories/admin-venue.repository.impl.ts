import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OwnerReview, OwnerReviewPage, OwnerReviewStatus } from '@application/dto/owner-review/owner-review.dto';
import {
  AdminReviewFilter, AdminVenueFilter, AdminVenuePage, AdminVenueRepository
} from '@application/ports/persistence/admin-venue.repository';
import { environment } from '@environments/environment';

interface PageResult<T> { items: T[]; total: number }

@Injectable({ providedIn: 'root' })
export class AdminVenueRepositoryImpl implements AdminVenueRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/admin`;

  getVenues(filter: AdminVenueFilter): Observable<AdminVenuePage> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.query) params = params.set('query', filter.query);
    return this.http.get<BaseResponse<PageResult<OwnerVenueOverview>>>(`${this.baseUrl}/venues`, { params })
      .pipe(map(response => ({ items: response.data?.items ?? [], total: response.data?.total ?? 0 })));
  }

  suspend(venueId: string, reason: string): Observable<OwnerVenueOverview> {
    return this.http.post<BaseResponse<OwnerVenueOverview>>(`${this.baseUrl}/venues/${venueId}/suspension`, { reason })
      .pipe(map(response => response.data));
  }

  reinstate(venueId: string): Observable<OwnerVenueOverview> {
    return this.http.delete<BaseResponse<OwnerVenueOverview>>(`${this.baseUrl}/venues/${venueId}/suspension`)
      .pipe(map(response => response.data));
  }

  getReviews(filter: AdminReviewFilter): Observable<OwnerReviewPage> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.rating) params = params.set('rating', filter.rating);
    if (filter.venueId) params = params.set('venueId', filter.venueId);
    return this.http.get<BaseResponse<BaseListResponse<OwnerReview>>>(`${this.baseUrl}/reviews`, { params })
      .pipe(map(response => ({
        items: response.data?.result ?? [],
        page: response.data?.meta.page ?? filter.page,
        pageSize: response.data?.meta.pageSize ?? filter.size,
        pages: response.data?.meta.pages ?? 0,
        total: response.data?.meta.total ?? 0
      })));
  }

  moderateReview(reviewId: string, status: OwnerReviewStatus): Observable<Pick<OwnerReview, 'reviewId' | 'status'>> {
    return this.http.patch<BaseResponse<Pick<OwnerReview, 'reviewId' | 'status'>>>(
      `${this.baseUrl}/reviews/${reviewId}/status`, { status }
    ).pipe(map(response => response.data));
  }
}
