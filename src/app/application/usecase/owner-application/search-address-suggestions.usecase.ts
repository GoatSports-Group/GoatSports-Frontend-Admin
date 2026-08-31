import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';
import {
  ADDRESS_SUGGESTION_REPOSITORY_TOKEN,
  AddressSuggestionRepository
} from '@application/ports/persistence/address-suggestion.repository';

@Injectable({ providedIn: 'root' })
export class SearchAddressSuggestionsUseCase {
  constructor(
    @Inject(ADDRESS_SUGGESTION_REPOSITORY_TOKEN)
    private readonly repository: AddressSuggestionRepository
  ) {}

  execute(query: string): Observable<AddressSuggestion[]> {
    return this.repository.search(query);
  }

  resolve(suggestion: AddressSuggestion): Observable<AddressSuggestion> {
    return this.repository.resolve(suggestion);
  }
}
