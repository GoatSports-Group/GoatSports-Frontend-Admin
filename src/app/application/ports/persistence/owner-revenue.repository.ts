import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerCustomerMetricsFilter,
  OwnerCustomerMetricsReport,
  OwnerRevenueFilter,
  OwnerRevenueReport
} from '@application/dto/owner-revenue/owner-revenue.dto';

export interface OwnerRevenueRepository {
  getRevenue(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport>;
  getCustomerMetrics(filter: OwnerCustomerMetricsFilter): Observable<OwnerCustomerMetricsReport>;
}

export const OWNER_REVENUE_REPOSITORY_TOKEN =
  new InjectionToken<OwnerRevenueRepository>('OWNER_REVENUE_REPOSITORY_TOKEN');
