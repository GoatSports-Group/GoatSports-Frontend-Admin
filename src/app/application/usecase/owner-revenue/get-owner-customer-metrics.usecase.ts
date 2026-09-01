import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerCustomerMetricsFilter,
  OwnerCustomerMetricsReport
} from '@application/dto/owner-revenue/owner-revenue.dto';
import {
  OWNER_REVENUE_REPOSITORY_TOKEN,
  OwnerRevenueRepository
} from '@application/ports/persistence/owner-revenue.repository';

@Injectable({ providedIn: 'root' })
export class GetOwnerCustomerMetricsUseCase {
  constructor(
    @Inject(OWNER_REVENUE_REPOSITORY_TOKEN)
    private readonly repository: OwnerRevenueRepository
  ) { }

  execute(filter: OwnerCustomerMetricsFilter): Observable<OwnerCustomerMetricsReport> {
    return this.repository.getCustomerMetrics(filter);
  }
}
