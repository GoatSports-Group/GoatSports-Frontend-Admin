import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { OwnerReview, OwnerReviewFilter } from '@application/dto/owner-review/owner-review.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class OwnerReviewApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/owner/reviews`;

  getReviews(filter: OwnerReviewFilter): Observable<BaseResponse<BaseListResponse<OwnerReview>>> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.venueId) params = params.set('venueId', filter.venueId);
    if (filter.venueCourtId) params = params.set('venueCourtId', filter.venueCourtId);
    if (filter.rating) params = params.set('rating', filter.rating);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get<BaseResponse<BaseListResponse<OwnerReview>>>(this.baseUrl, { params });
  }
}
