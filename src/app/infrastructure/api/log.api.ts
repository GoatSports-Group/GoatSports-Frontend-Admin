import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { Log } from '@domain/entities/log';
import { LogStatsResult } from '@application/dto/log/log-stats.dto';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@infrastructure/api/build-page-params';
import { environment } from "@environments/environment";

@Injectable({
  providedIn: 'root'
})
export class LogApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getLogs(filter: PageFilter): Observable<BaseResponse<BaseListResponse<Log>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<Log>>>(`${this.apiBase}/audit-service/api/v1/logs`, { params });
  }

  getStats(from: string, to: string): Observable<BaseResponse<LogStatsResult>> {
    return this.http.get<BaseResponse<LogStatsResult>>(`${this.apiBase}/audit-service/api/v1/logs/stats`, { params: { from, to } });
  }
}
