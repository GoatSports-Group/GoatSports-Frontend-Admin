import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Log } from '@application/dto/log/log.dto';
import { PageFilter } from '@application/dto/page.filter';
import { GetLogsUseCase } from '@application/usecase/log/get-logs.usecase';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private getLogsUseCase = inject(GetLogsUseCase);

  getLogs(filter: PageFilter): Observable<BaseListResponse<Log>> {
    return this.getLogsUseCase.execute(filter);
  }
}
