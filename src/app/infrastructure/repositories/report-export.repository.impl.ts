import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { ReportExport, ReportExportRepository } from '@application/ports/persistence/report-export.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportExportRepositoryImpl implements ReportExportRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/report-service/api/v1/reports/exports`;

  list(types: readonly string[]): Observable<ReportExport[]> {
    return this.http.get<BaseResponse<ReportExport[]>>(this.baseUrl, { params: { type: types.join(',') } })
      .pipe(map(response => response.data ?? []));
  }

  download(exportId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${exportId}/file`, { responseType: 'blob' });
  }
}
