import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type PaymentStatus =
  'CREATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type PaymentPurpose = 'BOOKING_DEPOSIT' | 'BOOKING_REMAINING' | 'TOURNAMENT_FEE';
export type RefundStatus =
  'CREATED' | 'AWAITING_CLAIM' | 'AWAITING_BANK_ACCOUNT' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'MANUAL_REVIEW';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'MANUAL_REVIEW';
export type PayoutKind = 'OWNER_WITHDRAWAL' | 'REFUND';

export interface FinanceSummary {
  from: string;
  to: string;
  collected: number;
  platformFee: number;
  paymentCount: number;
  refunded: number;
  paidOutToOwners: number;
  /** Tính tại thời điểm xem (không theo kỳ). */
  refundsNeedingAttention: number;
  payoutsNeedingAttention: number;
  /** Khoản hoàn đang lỗi: số trên nút "Chi lại tất cả". */
  failedRefunds: number;
  /** Khoản hoàn chờ người nhận quá 7 ngày. */
  staleRefunds: number;
}

export interface FinancePayment {
  paymentId: string;
  payerId: string;
  payeeId: string | null;
  purpose: PaymentPurpose;
  referenceType: 'BOOKING' | 'TOURNAMENT_REGISTRATION';
  referenceId: string;
  amount: number;
  platformFee: number | null;
  status: PaymentStatus;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface FinanceRefund {
  refundId: string;
  paymentId: string;
  payerId: string;
  purpose: PaymentPurpose;
  referenceType: 'BOOKING' | 'TOURNAMENT_REGISTRATION';
  referenceId: string;
  amount: number;
  status: RefundStatus;
  reason: string;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string | null;
  refundedAt: string | null;
  /** Mã giao dịch payOS, hoặc mã chuyển khoản chủ sân nhập khi hoàn tay. */
  providerRefundId: string | null;
  paymentDescription: string | null;
  lastRemindedAt: string | null;
  /** Đang chờ người chơi / chủ sân: gửi nhắc được. */
  remindable: boolean;
}

export interface FinanceRefundDetail {
  refund: FinanceRefund;
  /** Lượt chi payOS gắn với khoản hoàn (null nếu chưa chi lần nào). */
  payout: FinancePayout | null;
}

export interface BulkRetryResult {
  attempted: number;
  succeeded: number;
  processing: number;
  failed: number;
}

export interface FinancePayout {
  payoutId: string;
  kind: PayoutKind;
  payeeId: string;
  amount: number;
  status: PayoutStatus;
  destinationBankBin: string | null;
  destinationAccountMasked: string | null;
  destinationAccountName: string | null;
  failureCode: string | null;
  failureReason: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  referenceId: string | null;
  providerPayoutId: string | null;
}

export interface FinancePage<T> {
  items: T[];
  total: number;
}

export interface PaymentFilter {
  statuses?: PaymentStatus[];
  purposes?: PaymentPurpose[];
  from: string;
  to: string;
  page: number;
  size: number;
}

/** {@code keyword} khớp lý do / mã đặt sân / tên chủ tài khoản; {@code people} là mã người dùng khớp tên/email. */
export interface RefundQuery {
  statuses: RefundStatus[];
  keyword?: string;
  people?: string[];
  olderThanDays?: number;
}

export interface PayoutQuery {
  kind: PayoutKind;
  statuses: PayoutStatus[];
  keyword?: string;
  people?: string[];
}

/** Tài chính toàn sàn (payment-service, phía admin). */
export interface AdminFinanceRepository {
  getSummary(from: string, to: string): Observable<FinanceSummary>;
  getPayments(filter: PaymentFilter): Observable<FinancePage<FinancePayment>>;
  getRefunds(query: RefundQuery, page: number, size: number): Observable<FinancePage<FinanceRefund>>;
  getRefund(refundId: string): Observable<FinanceRefundDetail>;
  getPayouts(query: PayoutQuery, page: number, size: number): Observable<FinancePage<FinancePayout>>;
  /** Dự phòng sự cố phía nền tảng; từng khoản lỗi thì người chơi tự bấm "Thử lại". */
  retryFailedRefunds(): Observable<BulkRetryResult>;
  /** Tối đa một lần / 24 giờ mỗi khoản (backend chặn). */
  remindRefund(refundId: string): Observable<FinanceRefund>;
  /** CSV trong kỳ [from, to] theo ngày tạo / ngày yêu cầu chi. */
  exportRefunds(query: RefundQuery, from: string, to: string): Observable<Blob>;
  exportPayouts(query: PayoutQuery, from: string, to: string): Observable<Blob>;
}

export const ADMIN_FINANCE_REPOSITORY_TOKEN = new InjectionToken<AdminFinanceRepository>('ADMIN_FINANCE_REPOSITORY_TOKEN');
