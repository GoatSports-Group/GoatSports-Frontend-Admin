export type OwnerBookingStatus =
  | 'PENDING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED'
  | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'EXPIRED';

export type OwnerBookingSource = 'DIRECT' | 'AI_MATCHMAKING' | 'WALK_IN';
export type OwnerBookingPaymentMethod = 'CASH' | 'MOMO';

export interface CreateOwnerWalkInBooking {
  venueCourtId: string;
  timeSlotId: string;
  customerName: string;
  customerPhone: string;
}

export interface OwnerBookingPaymentResult {
  bookingId: string;
  paymentId: string;
  method: OwnerBookingPaymentMethod;
  status: string;
  checkoutUrl?: string;
  expiresAt?: string;
}

export interface OwnerPayment {
  paymentId: string;
  purpose: 'BOOKING_DEPOSIT' | 'BOOKING_REMAINING';
  amount: number;
  currency: string;
  status: string;
  paidAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface OwnerBooking {
  bookingId: string;
  playerId?: string;
  venueId: string;
  venueCourtId: string;
  venueName: string;
  courtName: string;
  playDate: string;
  startTime: string;
  endTime: string;
  status: OwnerBookingStatus;
  source: OwnerBookingSource;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  depositPaymentId?: string;
  remainingPaymentId?: string;
  bookingCode: string;
  qrCode?: string;
  walkInCustomerName?: string;
  walkInCustomerPhone?: string;
  matchmakingSessionId?: string;
  createdAt: string;
  updatedAt?: string;
  payments: OwnerPayment[];
  allowedTransitions: OwnerBookingStatus[];
}

export interface OwnerBookingFilter {
  venueId?: string;
  venueCourtId?: string;
  status?: OwnerBookingStatus;
  query?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  size: number;
}

export interface OwnerBookingPage {
  items: OwnerBooking[];
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}
