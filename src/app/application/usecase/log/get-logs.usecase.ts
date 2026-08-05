import { LogRepository, LOG_REPOSITORY_TOKEN } from '@application/ports/persistence/log.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Log } from '@domain/entities/log';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class GetLogsUseCase {
  constructor(
    @Inject(LOG_REPOSITORY_TOKEN) private logRepository: LogRepository
  ) { }

  execute(filter: PageFilter): Observable<BaseListResponse<Log>> {
    return this.logRepository.getLogs(filter);
  }
}
