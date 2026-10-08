import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
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

export interface OwnerRevenueRepository {
  getRevenue(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport>;
  getCustomerMetrics(filter: OwnerCustomerMetricsFilter): Observable<OwnerCustomerMetricsReport>;
  previewReport(filter: OwnerRevenueReportExportFilter): Observable<Blob>;
  exportReport(filter: OwnerRevenueReportExportFilter): Observable<Blob>;
  listPeriodicReports(periodType: PeriodicReportType): Observable<PeriodicReport[]>;
  generatePeriodicReport(periodType: PeriodicReportType): Observable<PeriodicReport>;
  exportPeriodicReport(reportId: string, format: PeriodicReportFormat): Observable<Blob>;
}

export const OWNER_REVENUE_REPOSITORY_TOKEN =
  new InjectionToken<OwnerRevenueRepository>('OWNER_REVENUE_REPOSITORY_TOKEN');
