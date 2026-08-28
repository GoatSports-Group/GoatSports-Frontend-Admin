export { Booking, BookingCancellation } from '@domain/entities/booking';
export { BookingStatus, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@domain/enums/booking-status.enum';

export interface ProcessCancellationRequest {
  approved: boolean;
  processNote?: string;
}
