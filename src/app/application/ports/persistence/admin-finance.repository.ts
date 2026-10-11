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
  /** Do backend quyết định (chỉ khoản đang lỗi). */
  retryable: boolean;
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

/** Tài chính toàn sàn (payment-service, phía admin). */
export interface AdminFinanceRepository {
  getSummary(from: string, to: string): Observable<FinanceSummary>;
  getPayments(filter: PaymentFilter): Observable<FinancePage<FinancePayment>>;
  getRefunds(statuses: RefundStatus[], page: number, size: number): Observable<FinancePage<FinanceRefund>>;
  getPayouts(kind: PayoutKind, statuses: PayoutStatus[], page: number, size: number): Observable<FinancePage<FinancePayout>>;
  retryRefund(refundId: string): Observable<FinanceRefund>;
}

export const ADMIN_FINANCE_REPOSITORY_TOKEN = new InjectionToken<AdminFinanceRepository>('ADMIN_FINANCE_REPOSITORY_TOKEN');
