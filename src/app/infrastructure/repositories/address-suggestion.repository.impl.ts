import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AddressSuggestionRepository } from '@application/ports/persistence/address-suggestion.repository';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';
import { AddressSuggestionApi } from '@infrastructure/api/address-suggestion.api';

@Injectable({ providedIn: 'root' })
export class AddressSuggestionRepositoryImpl implements AddressSuggestionRepository {
  private readonly api = inject(AddressSuggestionApi);

  search(query: string): Observable<AddressSuggestion[]> {
    return this.api.search(query);
  }

  resolve(suggestion: AddressSuggestion): Observable<AddressSuggestion> {
    return this.api.resolve(suggestion);
  }
}
