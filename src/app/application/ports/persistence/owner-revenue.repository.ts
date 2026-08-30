import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerRevenueFilter,
  OwnerRevenueReport
} from '@application/dto/owner-revenue/owner-revenue.dto';

export interface OwnerRevenueRepository {
  getRevenue(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport>;
}

export const OWNER_REVENUE_REPOSITORY_TOKEN =
  new InjectionToken<OwnerRevenueRepository>('OWNER_REVENUE_REPOSITORY_TOKEN');
