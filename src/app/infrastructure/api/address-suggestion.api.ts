import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class AddressSuggestionApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/address-suggestions`;

  search(query: string): Observable<AddressSuggestion[]> {
    const normalizedQuery = query.trim().slice(0, 160);
    if (normalizedQuery.length < 3) return of([]);
    const params = new HttpParams().set('query', normalizedQuery);

    return this.http.get<BaseResponse<AddressSuggestion[]>>(this.baseUrl, { params }).pipe(
      map(response => response.data ?? [])
    );
  }

  resolve(suggestion: AddressSuggestion): Observable<AddressSuggestion> {
    const params = new HttpParams().set('refId', suggestion.refId);

    return this.http.get<BaseResponse<AddressSuggestion>>(`${this.baseUrl}/resolve`, { params }).pipe(
      map(response => response.data)
    );
  }
}
