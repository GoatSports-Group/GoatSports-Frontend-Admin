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
  /** Đánh dấu đã xử lý; cảnh báo hiện lại khi tài khoản đó đăng nhập sai lần mới. */
  resolveFailedLogins(account: string): Observable<void>;
}

export const LOG_REPOSITORY_TOKEN = new InjectionToken<LogRepository>('LogRepository');
