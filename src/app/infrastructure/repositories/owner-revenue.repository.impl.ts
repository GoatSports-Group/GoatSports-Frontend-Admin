import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  OwnerRevenueFilter,
  OwnerRevenueReport
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerRevenueRepository } from '@application/ports/persistence/owner-revenue.repository';
import { OwnerRevenueApi } from '@infrastructure/api/owner-revenue.api';

@Injectable()
export class OwnerRevenueRepositoryImpl implements OwnerRevenueRepository {
  private readonly api = inject(OwnerRevenueApi);

  getRevenue(filter: OwnerRevenueFilter): Observable<OwnerRevenueReport> {
    return this.api.getRevenue(filter).pipe(map(response => response.data));
  }
}
