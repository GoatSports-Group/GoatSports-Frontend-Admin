import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  OwnerCustomerMetricsFilter,
  OwnerCustomerMetricsReport,
  OwnerRevenueFilter,
  OwnerRevenueReportExportFilter,
  OwnerRevenueReport,
  PeriodicReport,
  PeriodicReportFormat,
  PeriodicReportType
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerRevenueRepository } from '@application/ports/persistence/owner-revenue.repository';
import { OwnerRevenueApi } from '@infrastructure/api/owner-revenue.api';

@Injectable()
export class OwnerRevenueRepositoryImpl implements OwnerRevenueRepository {
  private readonly api = inject(OwnerRevenueApi);

  getRevenue(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport> {
    return this.api.getRevenue(filter).pipe(map(response => response.data));
  }

  getCustomerMetrics(filter: OwnerCustomerMetricsFilter): Observable<OwnerCustomerMetricsReport> {
    return this.api.getCustomerMetrics(filter).pipe(map(response => response.data));
  }

  previewReport(filter: OwnerRevenueReportExportFilter): Observable<Blob> {
    return this.api.previewReport(filter);
  }

  exportReport(filter: OwnerRevenueReportExportFilter): Observable<Blob> {
    return this.api.exportReport(filter);
  }

  listPeriodicReports(periodType: PeriodicReportType): Observable<PeriodicReport[]> {
    return this.api.listPeriodicReports(periodType).pipe(map(response => response.data ?? []));
  }

  generatePeriodicReport(periodType: PeriodicReportType): Observable<PeriodicReport> {
    return this.api.generatePeriodicReport(periodType).pipe(map(response => response.data));
  }

  exportPeriodicReport(reportId: string, format: PeriodicReportFormat): Observable<Blob> {
    return this.api.exportPeriodicReport(reportId, format);
  }
}
