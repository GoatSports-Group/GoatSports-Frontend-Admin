export interface BankDirectoryEntry { id: number; name: string; code: string; bin: string; shortName: string; logo: string; transferSupported: boolean; }
export type BankAccountStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'DISABLED';
export interface BankAccount { bankAccountId: string; bankBin: string; accountNumberLast4: string; accountName: string; status: BankAccountStatus; isDefault: boolean; verifiedAt?: string; createdAt: string; }
/** Số dư doanh thu (payment-service GET /payouts/me/balance): tiền thu đã qua thời gian giữ − hoàn khách − đã rút. */
export interface PayoutBalance { earned: number; refunded: number; withdrawn: number; onHold: number; available: number; holdDays: number; minimumWithdrawal: number; }
export type WithdrawalStatus = 'PENDING' | 'HELD' | 'READY' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
export interface Withdrawal { settlementId: string; amount: number; status: WithdrawalStatus; destinationAccount?: string; destinationAccountName?: string; failureReason?: string; requestedAt: string; settledAt?: string; }
export interface LinkBankAccountRequest { bankBin: string; accountNumber: string; accountName: string; }
