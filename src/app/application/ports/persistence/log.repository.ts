import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Log } from '@domain/entities/log';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

export interface LogRepository {
  getLogs(filter: PageFilter): Observable<BaseListResponse<Log>>;
}

export const LOG_REPOSITORY_TOKEN = new InjectionToken<LogRepository>('LogRepository');
