import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccount, BankDirectoryEntry } from '@application/dto/bank-account/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
export interface BankAccountRepository {
  getBanks(): Observable<BankDirectoryEntry[]>;
  getMyAccounts(): Observable<BankAccount[]>;
  getEncryptionPublicKey(): Observable<string>;
  link(request: EncryptedPayload): Observable<BankAccount>;
  makeDefault(request: EncryptedPayload): Observable<BankAccount>;
  disable(request: EncryptedPayload): Observable<void>;
}
export const BANK_ACCOUNT_REPOSITORY_TOKEN = new InjectionToken<BankAccountRepository>('BANK_ACCOUNT_REPOSITORY_TOKEN');
