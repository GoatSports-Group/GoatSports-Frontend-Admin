import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { AiStatus, SystemHealth, SystemMonitorRepository } from '@application/ports/persistence/system-monitor.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class SystemMonitorRepositoryImpl implements SystemMonitorRepository {
  private readonly http = inject(HttpClient);

  getServicesHealth(): Observable<SystemHealth> {
    return this.http.get<BaseResponse<SystemHealth>>(`${environment.apiUrl}/audit-service/api/v1/admin/system/services`)
      .pipe(map(response => response.data));
  }

  /** ai-service (FastAPI) trả thẳng JSON, không bọc BaseResponse như các service Spring. */
  getAiStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${environment.apiUrl}/ai-service/api/v1/ai/admin/status`);
  }
}
