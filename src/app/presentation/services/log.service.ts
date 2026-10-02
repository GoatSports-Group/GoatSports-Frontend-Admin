import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Log } from '@application/dto/log/log.dto';
import { PageFilter } from '@application/dto/page.filter';
import { GetLogsUseCase } from '@application/usecase/log/get-logs.usecase';
import { BaseListResponse } from '@application/dto/base/base-response';
import { LogStatsResult } from '@application/dto/log/log-stats.dto';
import { LOG_REPOSITORY_TOKEN } from '@application/ports/persistence/log.repository';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private getLogsUseCase = inject(GetLogsUseCase);
  private logRepository = inject(LOG_REPOSITORY_TOKEN);

  getLogs(filter: PageFilter): Observable<BaseListResponse<Log>> {
    return this.getLogsUseCase.execute(filter);
  }

  /** Thong ke [from, to) dem o audit-service (khong tai log ve client de dem). */
  getStats(from: string, to: string): Observable<LogStatsResult> {
    return this.logRepository.getStats(from, to);
  }
}
