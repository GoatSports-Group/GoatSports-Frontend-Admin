import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerRevenueFilter,
  OwnerRevenueReportExportFilter,
  OwnerRevenueReport
} from '@application/dto/owner-revenue/owner-revenue.dto';
import {
  OWNER_REVENUE_REPOSITORY_TOKEN,
  OwnerRevenueRepository
} from '@application/ports/persistence/owner-revenue.repository';

@Injectable({ providedIn: 'root' })
export class GetOwnerRevenueUseCase {
  constructor(
    @Inject(OWNER_REVENUE_REPOSITORY_TOKEN)
    private readonly repository: OwnerRevenueRepository
  ) { }

  execute(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport> {
    return this.repository.getRevenue(filter);
  }

  previewReport(filter: OwnerRevenueReportExportFilter): Observable<Blob> {
    return this.repository.previewReport(filter);
  }

  exportReport(filter: OwnerRevenueReportExportFilter): Observable<Blob> {
    return this.repository.exportReport(filter);
  }
}
