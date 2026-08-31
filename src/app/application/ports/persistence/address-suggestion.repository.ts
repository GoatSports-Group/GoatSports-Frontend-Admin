import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';

export interface AddressSuggestionRepository {
  search(query: string): Observable<AddressSuggestion[]>;
  resolve(suggestion: AddressSuggestion): Observable<AddressSuggestion>;
}

export const ADDRESS_SUGGESTION_REPOSITORY_TOKEN =
  new InjectionToken<AddressSuggestionRepository>('AddressSuggestionRepository');
