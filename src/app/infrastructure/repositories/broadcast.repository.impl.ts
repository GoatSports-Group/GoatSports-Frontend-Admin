import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import {
  Broadcast, BroadcastAudience, BroadcastPage, BroadcastRepository, SendBroadcastRequest
} from '@application/ports/persistence/broadcast.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class BroadcastRepositoryImpl implements BroadcastRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notification-service/api/v1/admin/broadcasts`;

  send(request: SendBroadcastRequest, idempotencyKey: string): Observable<Broadcast> {
    return this.http.post<BaseResponse<Broadcast>>(this.baseUrl, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey })
    }).pipe(map(response => response.data));
  }

  list(page: number, size: number): Observable<BroadcastPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<BaseResponse<BaseListResponse<Broadcast>>>(this.baseUrl, { params })
      .pipe(map(response => ({ items: response.data?.result ?? [], total: response.data?.meta.total ?? 0 })));
  }

  countAudience(audience: BroadcastAudience): Observable<number> {
    return this.http.get<BaseResponse<number>>(`${this.baseUrl}/audience-count`, { params: { audience } })
      .pipe(map(response => response.data ?? 0));
  }
}
