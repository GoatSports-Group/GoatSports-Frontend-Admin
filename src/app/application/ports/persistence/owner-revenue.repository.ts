import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerCustomerMetricsFilter,
  OwnerCustomerMetricsReport,
  OwnerRevenueFilter,
  OwnerRevenueReportExportFilter,
  OwnerRevenueReport
} from '@application/dto/owner-revenue/owner-revenue.dto';

export interface OwnerRevenueRepository {
  getRevenue(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport>;
  getCustomerMetrics(filter: OwnerCustomerMetricsFilter): Observable<OwnerCustomerMetricsReport>;
  previewReport(filter: OwnerRevenueReportExportFilter): Observable<Blob>;
  exportReport(filter: OwnerRevenueReportExportFilter): Observable<Blob>;
}

export const OWNER_REVENUE_REPOSITORY_TOKEN =
  new InjectionToken<OwnerRevenueRepository>('OWNER_REVENUE_REPOSITORY_TOKEN');
