import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccount, BankDirectoryEntry, LinkBankAccountRequest } from '@application/dto/bank-account/bank-account.dto';
export interface BankAccountRepository {
  getBanks(): Observable<BankDirectoryEntry[]>;
  getMyAccounts(): Observable<BankAccount[]>;
  link(request: LinkBankAccountRequest): Observable<BankAccount>;
  makeDefault(id: string): Observable<BankAccount>;
  disable(id: string): Observable<void>;
}
export const BANK_ACCOUNT_REPOSITORY_TOKEN = new InjectionToken<BankAccountRepository>('BANK_ACCOUNT_REPOSITORY_TOKEN');
