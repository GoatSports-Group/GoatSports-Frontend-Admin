import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';

export type CheckInMethod = 'QR_CODE' | 'BOOKING_CODE' | 'MANUAL';
export type PaymentCollectionMode = 'NONE' | 'CASH' | 'ONLINE';

export interface OwnerCheckInRecord {
  checkInId: string;
  paymentId?: string;
  checkedInBy: string;
  method: CheckInMethod;
  remainingAmountCollected: number;
  checkedInAt: string;
}

export interface OwnerCheckInResult {
  booking: OwnerBooking;
  checkIn?: OwnerCheckInRecord;
  outstandingAmount: number;
  checkInEligible?: boolean;
  checkInMessage?: string;
}

export interface OwnerCheckInLookup {
  bookingId?: string;
  qrCode?: string;
  bookingCode?: string;
}

export interface ConfirmOwnerCheckIn {
  bookingId: string;
  method: CheckInMethod;
  paymentMode: PaymentCollectionMode;
  qrCode?: string;
  bookingCode?: string;
}

export interface CreateWalkInBooking {
  venueCourtId: string;
  timeSlotId: string;
  customerName: string;
  customerPhone: string;
}

export interface OwnerCheckInFilter {
  venueId?: string;
  venueCourtId?: string;
  date?: string;
  page: number;
  size: number;
}

export interface OwnerCheckInPage {
  items: OwnerCheckInResult[];
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}
