import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BaseResponse } from '@application/dto/base/base-response';
import { BankAccount, BankDirectoryEntry } from '@application/dto/bank-account/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
import { environment } from '@environments/environment';
@Injectable({ providedIn: 'root' })
export class BankAccountApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payment-service/api/v1`;
  getBanks() { return this.http.get<BaseResponse<BankDirectoryEntry[]>>(`${this.baseUrl}/banks`); }
  getMyAccounts() { return this.http.get<BaseResponse<BankAccount[]>>(`${this.baseUrl}/bank-accounts/me`); }
  getEncryptionPublicKey() { return this.http.get<BaseResponse<{ publicKey: string }>>(`${this.baseUrl}/bank-accounts/public-key`); }
  link(request: EncryptedPayload) { return this.http.post<BaseResponse<BankAccount>>(`${this.baseUrl}/bank-accounts`, request); }
  makeDefault(request: EncryptedPayload) { return this.http.patch<BaseResponse<BankAccount>>(`${this.baseUrl}/bank-accounts/default`, request); }
  disable(request: EncryptedPayload) { return this.http.patch<void>(`${this.baseUrl}/bank-accounts/disable`, request); }
}
