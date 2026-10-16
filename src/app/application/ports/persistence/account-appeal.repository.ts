import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountAppeal, AccountAppealPage, AccountAppealStatus } from '@application/dto/account-appeal/account-appeal.dto';

/** Hộp thư khiếu nại của tài khoản bị khóa. Mở khóa tài khoản dùng UserRepository.changeStatus. */
export interface AccountAppealRepository {
  /** page bắt đầu từ 0; status null = mọi thư. */
  list(status: AccountAppealStatus | null, page: number, size: number): Observable<AccountAppealPage>;
  unreadCount(): Observable<number>;
  /** Mở thư: thư mới chuyển sang đã đọc; kèm trạng thái hiện tại của tài khoản. */
  open(appealId: string): Observable<AccountAppeal>;
  reply(appealId: string, message: string, resolve: boolean): Observable<AccountAppeal>;
  changeStatus(appealId: string, status: 'READ' | 'RESOLVED'): Observable<AccountAppeal>;
}

export const ACCOUNT_APPEAL_REPOSITORY_TOKEN = new InjectionToken<AccountAppealRepository>('ACCOUNT_APPEAL_REPOSITORY_TOKEN');
