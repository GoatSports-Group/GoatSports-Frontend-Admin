import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';
import { environment } from '@environments/environment';
import {
  VietMapAutocompleteResult,
  VietMapPlaceResult,
  mapVietMapSuggestion,
  mergeVietMapPlace
} from './address-suggestion.mapper';

@Injectable({ providedIn: 'root' })
export class AddressSuggestionApi {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly baseUrl = environment.vietMapApiUrl.replace(/\/$/, '');

  search(query: string): Observable<AddressSuggestion[]> {
    const normalizedQuery = query.trim().slice(0, 160);
    if (normalizedQuery.length < 3) return of([]);
    if (!environment.vietMapApiKey) {
      return throwError(() => new Error('NG_APP_VIETMAP_API_KEY chưa được cấu hình'));
    }

    const params = new HttpParams()
      .set('apikey', environment.vietMapApiKey)
      .set('text', normalizedQuery)
      .set('display_type', '5');

    return this.http.get<VietMapAutocompleteResult[]>(`${this.baseUrl}/autocomplete/v4`, { params }).pipe(
      map(response => (response ?? [])
        .map(result => mapVietMapSuggestion(result))
        .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
        .slice(0, 6))
    );
  }

  resolve(suggestion: AddressSuggestion): Observable<AddressSuggestion> {
    if (!environment.vietMapApiKey) {
      return throwError(() => new Error('NG_APP_VIETMAP_API_KEY chưa được cấu hình'));
    }
    const params = new HttpParams()
      .set('apikey', environment.vietMapApiKey)
      .set('refid', suggestion.refId);

    return this.http.get<VietMapPlaceResult>(`${this.baseUrl}/place/v4`, { params }).pipe(
      map(place => mergeVietMapPlace(suggestion, place))
    );
  }
}
