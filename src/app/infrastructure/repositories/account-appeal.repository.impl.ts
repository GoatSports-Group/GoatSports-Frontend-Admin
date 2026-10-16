import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { AccountAppeal, AccountAppealPage, AccountAppealStatus } from '@application/dto/account-appeal/account-appeal.dto';
import { AccountAppealRepository } from '@application/ports/persistence/account-appeal.repository';
import { environment } from '@environments/environment';

interface AppealListBody {
  meta: { page: number; pageSize: number; pages: number; total: number };
  result: AccountAppeal[];
}

@Injectable({ providedIn: 'root' })
export class AccountAppealRepositoryImpl implements AccountAppealRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth-service/api/v1/admin/account-appeals`;

  list(status: AccountAppealStatus | null, page: number, size: number): Observable<AccountAppealPage> {
    // auth-service đánh số trang từ 1.
    let params = new HttpParams().set('page', page + 1).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<BaseResponse<AppealListBody>>(this.base, { params }).pipe(map(response => ({
      items: response.data?.result ?? [],
      total: response.data?.meta?.total ?? 0,
      page,
      pages: response.data?.meta?.pages ?? 0
    })));
  }

  unreadCount(): Observable<number> {
    return this.http.get<BaseResponse<{ count: number }>>(`${this.base}/unread-count`)
      .pipe(map(response => response.data?.count ?? 0));
  }

  open(appealId: string): Observable<AccountAppeal> {
    return this.http.get<BaseResponse<AccountAppeal>>(`${this.base}/${appealId}`).pipe(map(response => response.data));
  }

  reply(appealId: string, message: string, resolve: boolean): Observable<AccountAppeal> {
    return this.http.post<BaseResponse<AccountAppeal>>(`${this.base}/${appealId}/reply`, { message, resolve })
      .pipe(map(response => response.data));
  }

  changeStatus(appealId: string, status: 'READ' | 'RESOLVED'): Observable<AccountAppeal> {
    return this.http.put<BaseResponse<AccountAppeal>>(`${this.base}/${appealId}/status`, { status })
      .pipe(map(response => response.data));
  }
}
