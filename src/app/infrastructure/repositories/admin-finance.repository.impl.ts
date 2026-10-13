import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import {
  AdminFinanceRepository, BulkRetryResult, FinanceExportRequest, FinancePage, FinancePayment, FinancePayout, FinanceRefund,
  FinanceRefundDetail, FinanceSummary, PaymentFilter, PayoutQuery, RefundQuery
} from '@application/ports/persistence/admin-finance.repository';
import { ReportExport } from '@application/ports/persistence/report-export.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminFinanceRepositoryImpl implements AdminFinanceRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payment-service/api/v1/admin/finance`;
  /** Báo cáo dựng ở report-service (Jasper), không phải payment-service. */
  private readonly exportsUrl = `${environment.apiUrl}/report-service/api/v1/reports/exports/finance`;

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

  getRefunds(query: RefundQuery, page: number, size: number): Observable<FinancePage<FinanceRefund>> {
    return this.page<FinanceRefund>('refunds', refundParams(query).set('page', page).set('size', size));
  }

  getRefund(refundId: string): Observable<FinanceRefundDetail> {
    return this.http.get<BaseResponse<FinanceRefundDetail>>(`${this.baseUrl}/refunds/${refundId}`)
      .pipe(map(response => response.data));
  }

  getPayouts(query: PayoutQuery, page: number, size: number): Observable<FinancePage<FinancePayout>> {
    return this.page<FinancePayout>('payouts', payoutParams(query).set('page', page).set('size', size));
  }

  retryFailedRefunds(): Observable<BulkRetryResult> {
    return this.http.post<BaseResponse<BulkRetryResult>>(`${this.baseUrl}/refunds/retry-failed`, null)
      .pipe(map(response => response.data));
  }

  remindRefund(refundId: string): Observable<FinanceRefund> {
    return this.http.post<BaseResponse<FinanceRefund>>(`${this.baseUrl}/refunds/${refundId}/remind`, null)
      .pipe(map(response => response.data));
  }

  requestExport(request: FinanceExportRequest): Observable<ReportExport> {
    const query = request.query;
    return this.http.post<BaseResponse<ReportExport>>(this.exportsUrl, {
      kind: request.kind,
      format: request.format,
      scopeLabel: request.scopeLabel,
      filter: {
        payoutKind: request.kind === 'PAYOUTS' ? request.query.kind : null,
        statuses: query.statuses,
        keyword: query.keyword?.trim() || null,
        people: query.keyword?.trim() ? query.people ?? [] : [],
        olderThanDays: request.kind === 'REFUNDS' ? request.query.olderThanDays ?? null : null,
        fromDate: request.from,
        toDate: request.to
      }
    }).pipe(map(response => response.data));
  }

  private page<T>(path: string, params: HttpParams): Observable<FinancePage<T>> {
    return this.http.get<BaseResponse<FinancePage<T>>>(`${this.baseUrl}/${path}`, { params })
      .pipe(map(response => ({ items: response.data?.items ?? [], total: response.data?.total ?? 0 })));
  }
}

function refundParams(query: RefundQuery): HttpParams {
  let params = searchParams(query.statuses, query.keyword, query.people);
  if (query.olderThanDays) params = params.set('olderThanDays', query.olderThanDays);
  return params;
}

function payoutParams(query: PayoutQuery): HttpParams {
  return searchParams(query.statuses, query.keyword, query.people).set('kind', query.kind);
}

function searchParams(statuses: readonly string[], keyword?: string, people?: readonly string[]): HttpParams {
  let params = new HttpParams();
  if (statuses.length) params = params.set('status', statuses.join(','));
  if (keyword?.trim()) params = params.set('q', keyword.trim());
  if (people?.length) params = params.set('people', people.join(','));
  return params;
}
