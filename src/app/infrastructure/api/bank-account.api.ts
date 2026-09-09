import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BaseResponse } from '@application/dto/base/base-response';
import { BankAccount, BankDirectoryEntry, LinkBankAccountRequest } from '@application/dto/bank-account/bank-account.dto';
import { environment } from '@environments/environment';
@Injectable({ providedIn: 'root' })
export class BankAccountApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payment-service/api/v1`;
  getBanks() { return this.http.get<BaseResponse<BankDirectoryEntry[]>>(`${this.baseUrl}/banks`); }
  getMyAccounts() { return this.http.get<BaseResponse<BankAccount[]>>(`${this.baseUrl}/bank-accounts/me`); }
  link(request: LinkBankAccountRequest) { return this.http.post<BaseResponse<BankAccount>>(`${this.baseUrl}/bank-accounts`, request); }
  makeDefault(id: string) { return this.http.patch<BaseResponse<BankAccount>>(`${this.baseUrl}/bank-accounts/${id}/default`, {}); }
  disable(id: string) { return this.http.delete<void>(`${this.baseUrl}/bank-accounts/${id}`); }
}
