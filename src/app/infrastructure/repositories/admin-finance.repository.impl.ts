import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  AdminFinanceRepository, FinancePage, FinancePayment, FinancePayout, FinanceRefund, FinanceSummary, PaymentFilter,
  PayoutKind, PayoutStatus, RefundStatus
} from '@application/ports/persistence/admin-finance.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminFinanceRepositoryImpl implements AdminFinanceRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payment-service/api/v1/admin/finance`;

  getSummary(from: string, to: string): Observable<FinanceSummary> {
    return this.http.get<BaseResponse<FinanceSummary>>(`${this.baseUrl}/summary`, { params: { from, to } })
      .pipe(map(response => response.data));
  }

  getPayments(filter: PaymentFilter): Observable<FinancePage<FinancePayment>> {
    let params = new HttpParams().set('from', filter.from).set('to', filter.to).set('page', filter.page).set('size', filter.size);
    if (filter.statuses?.length) params = params.set('status', filter.statuses.join(','));
    if (filter.purposes?.length) params = params.set('purpose', filter.purposes.join(','));
    return this.page<FinancePayment>('payments', params);
  }

  getRefunds(statuses: RefundStatus[], page: number, size: number): Observable<FinancePage<FinanceRefund>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (statuses.length) params = params.set('status', statuses.join(','));
    return this.page<FinanceRefund>('refunds', params);
  }

  getPayouts(kind: PayoutKind, statuses: PayoutStatus[], page: number, size: number): Observable<FinancePage<FinancePayout>> {
    let params = new HttpParams().set('kind', kind).set('page', page).set('size', size);
    if (statuses.length) params = params.set('status', statuses.join(','));
    return this.page<FinancePayout>('payouts', params);
  }

  retryRefund(refundId: string): Observable<FinanceRefund> {
    return this.http.post<BaseResponse<FinanceRefund>>(`${this.baseUrl}/refunds/${refundId}/retry`, null)
      .pipe(map(response => response.data));
  }

  private page<T>(path: string, params: HttpParams): Observable<FinancePage<T>> {
    return this.http.get<BaseResponse<FinancePage<T>>>(`${this.baseUrl}/${path}`, { params })
      .pipe(map(response => ({ items: response.data?.items ?? [], total: response.data?.total ?? 0 })));
  }
}
