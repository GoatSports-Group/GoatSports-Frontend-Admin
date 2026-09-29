import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CommunityStats, PlatformBookingStats, PlatformUserStats } from '@application/dto/admin-stats/admin-stats.dto';

export interface AdminStatsRepository {
  getUserStats(fromDate: string, toDate: string): Observable<PlatformUserStats>;
  getBookingStats(fromDate: string, toDate: string): Observable<PlatformBookingStats>;
  getCommunityStats(): Observable<CommunityStats>;
}

export const ADMIN_STATS_REPOSITORY_TOKEN = new InjectionToken<AdminStatsRepository>('ADMIN_STATS_REPOSITORY_TOKEN');
