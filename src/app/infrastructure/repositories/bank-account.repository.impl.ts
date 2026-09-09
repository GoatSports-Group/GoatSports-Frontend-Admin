import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { BankAccount, LinkBankAccountRequest } from '@application/dto/bank-account/bank-account.dto';
import { BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { BankAccountApi } from '@infrastructure/api/bank-account.api';
@Injectable({ providedIn: 'root' })
export class BankAccountRepositoryImpl implements BankAccountRepository {
  private readonly api = inject(BankAccountApi);
  getBanks() { return this.api.getBanks().pipe(map(response => response.data ?? [])); }
  getMyAccounts() { return this.api.getMyAccounts().pipe(map(response => response.data ?? [])); }
  link(request: LinkBankAccountRequest) { return this.api.link(request).pipe(map(response => this.required(response.data))); }
  makeDefault(id: string) { return this.api.makeDefault(id).pipe(map(response => this.required(response.data))); }
  disable(id: string) { return this.api.disable(id); }
  private required<T>(data: T | null | undefined): T { if (data == null) throw new Error('Payment service không trả dữ liệu.'); return data; }
}
