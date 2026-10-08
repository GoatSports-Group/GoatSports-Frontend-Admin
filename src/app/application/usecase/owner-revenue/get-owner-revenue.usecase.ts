import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerRevenueFilter,
  OwnerRevenueReportExportFilter,
  OwnerRevenueReport,
  PeriodicReport,
  PeriodicReportFormat,
  PeriodicReportType
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

  listPeriodicReports(periodType: PeriodicReportType): Observable<PeriodicReport[]> {
    return this.repository.listPeriodicReports(periodType);
  }

  generatePeriodicReport(periodType: PeriodicReportType): Observable<PeriodicReport> {
    return this.repository.generatePeriodicReport(periodType);
  }

  exportPeriodicReport(reportId: string, format: PeriodicReportFormat): Observable<Blob> {
    return this.repository.exportPeriodicReport(reportId, format);
  }
}
