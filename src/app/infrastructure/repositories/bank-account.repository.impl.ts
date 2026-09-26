import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { BankAccount } from '@application/dto/bank-account/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
import { BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { BankAccountApi } from '@infrastructure/api/bank-account.api';
@Injectable({ providedIn: 'root' })
export class BankAccountRepositoryImpl implements BankAccountRepository {
  private readonly api = inject(BankAccountApi);
  getBanks() { return this.api.getBanks().pipe(map(response => response.data ?? [])); }
  getMyAccounts() { return this.api.getMyAccounts().pipe(map(response => response.data ?? [])); }
  getEncryptionPublicKey() { return this.api.getEncryptionPublicKey().pipe(map(response => this.required(response.data).publicKey)); }
  link(request: EncryptedPayload) { return this.api.link(request).pipe(map(response => this.required(response.data))); }
  makeDefault(request: EncryptedPayload) { return this.api.makeDefault(request).pipe(map(response => this.required(response.data))); }
  disable(request: EncryptedPayload) { return this.api.disable(request); }
  getPayoutBalance() { return this.api.getPayoutBalance().pipe(map(response => this.required(response.data))); }
  getWithdrawals() { return this.api.getWithdrawals().pipe(map(response => response.data ?? [])); }
  withdraw() { return this.api.withdraw().pipe(map(response => this.required(response.data))); }
  private required<T>(data: T | null | undefined): T { if (data == null) throw new Error('Payment service không trả dữ liệu.'); return data; }
}
