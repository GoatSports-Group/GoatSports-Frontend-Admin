import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { LogRepository } from '@application/ports/persistence/log.repository';
import { LogApi } from '@infrastructure/api/log.api';
import { Log } from '@domain/entities/log';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

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
}
