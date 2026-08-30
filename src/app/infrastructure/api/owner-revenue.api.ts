import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  OwnerRevenueFilter,
  OwnerRevenueReport
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class OwnerRevenueApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/owner/revenue`;

  getRevenue(filter: OwnerRevenueFilter): Observable<BaseResponse<OwnerRevenueReport>> {
    let params = new HttpParams()
      .set('fromDate', filter.fromDate)
      .set('toDate', filter.toDate);
    if (filter.venueId) params = params.set('venueId', filter.venueId);
    return this.http.get<BaseResponse<OwnerRevenueReport>>(this.baseUrl, { params });
  }
}
