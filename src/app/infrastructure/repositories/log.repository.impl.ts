import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { LogRepository } from '@application/ports/persistence/log.repository';
import { LogApi } from '@infrastructure/api/log.api';
import { Log } from '@domain/entities/log';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';
import { FailedLoginBurst, LogStatsResult } from '@application/dto/log/log-stats.dto';

@Injectable({
  providedIn: 'root'
})
export class LogRepositoryImpl implements LogRepository {
  private logApi = inject(LogApi);

  getLogs(filter: PageFilter): Observable<BaseListResponse<Log>> {
    return this.logApi.getLogs(filter).pipe(
      map(response => response.data)
    );
  }

  getFailedLoginBursts(): Observable<FailedLoginBurst[]> {
    return this.logApi.getFailedLoginBursts().pipe(map(response => response.data ?? []));
  }

  resolveFailedLogins(account: string): Observable<void> {
    return this.logApi.resolveFailedLogins(account);
  }

  getStats(from: string, to: string): Observable<LogStatsResult> {
    return this.logApi.getStats(from, to).pipe(map(response => response.data));
  }
}
