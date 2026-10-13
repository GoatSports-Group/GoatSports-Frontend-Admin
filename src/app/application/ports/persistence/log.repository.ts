import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Log } from '@domain/entities/log';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';
import { FailedLoginBurst, LogStatsResult } from '@application/dto/log/log-stats.dto';

export interface LogRepository {
  getLogs(filter: PageFilter): Observable<BaseListResponse<Log>>;
  getStats(from: string, to: string): Observable<LogStatsResult>;
  getFailedLoginBursts(): Observable<FailedLoginBurst[]>;
}

export const LOG_REPOSITORY_TOKEN = new InjectionToken<LogRepository>('LogRepository');
