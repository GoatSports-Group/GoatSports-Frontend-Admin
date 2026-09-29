import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { CommunityStats, PlatformBookingStats, PlatformUserStats } from '@application/dto/admin-stats/admin-stats.dto';
import { AdminStatsRepository } from '@application/ports/persistence/admin-stats.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminStatsRepositoryImpl implements AdminStatsRepository {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getUserStats(fromDate: string, toDate: string): Observable<PlatformUserStats> {
    return this.http.get<BaseResponse<PlatformUserStats>>(`${this.api}/auth-service/api/v1/admin/stats/users`,
      { params: new HttpParams().set('fromDate', fromDate).set('toDate', toDate) }).pipe(map(response => response.data));
  }

  getBookingStats(fromDate: string, toDate: string): Observable<PlatformBookingStats> {
    return this.http.get<BaseResponse<PlatformBookingStats>>(`${this.api}/venue-service/api/v1/admin/stats/bookings`,
      { params: new HttpParams().set('fromDate', fromDate).set('toDate', toDate) }).pipe(map(response => response.data));
  }

  getCommunityStats(): Observable<CommunityStats> {
    return this.http.get<BaseResponse<CommunityStats>>(`${this.api}/club-service/api/v1/admin/stats/community`)
      .pipe(map(response => response.data));
  }
}
