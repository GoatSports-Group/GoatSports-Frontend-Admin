import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { ADMIN_BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-booking.repository';
import { AdminBookingsComponent } from './bookings.component';

describe('AdminBookingsComponent', () => {
  const booking: OwnerBooking = {
    bookingId: 'booking-1', playerId: 'player-12345678', venueId: 'venue-1', venueCourtId: 'court-1',
    venueName: 'Goat Arena', courtName: 'Sân A', playDate: '2026-08-29',
    startTime: '08:00:00', endTime: '09:00:00', status: 'CONFIRMED', source: 'DIRECT',
    totalPrice: 200000, depositAmount: 60000, remainingAmount: 140000,
    bookingCode: 'GS123456', createdAt: '2026-08-28T08:00:00',
    payments: [
      { paymentId: 'p-1', purpose: 'BOOKING_DEPOSIT', amount: 60000, currency: 'VND', status: 'SUCCEEDED', createdAt: '2026-08-28T08:01:00' },
      { paymentId: 'p-2', purpose: 'BOOKING_REMAINING', amount: 140000, currency: 'VND', status: 'FAILED', createdAt: '2026-08-28T08:02:00' }
    ],
    allowedTransitions: []
  };
  const repository = { getBookings: vi.fn(), getBooking: vi.fn() };

  beforeEach(async () => {
    repository.getBookings.mockReset().mockReturnValue(of({ items: [booking], page: 0, pageSize: 20, pages: 1, total: 1 }));
    await TestBed.configureTestingModule({
      imports: [AdminBookingsComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_BOOKING_REPOSITORY_TOKEN, useValue: repository }
      ]
    }).compileComponents();
  });

  it('lists every venue booking and sums only succeeded payments as collected', () => {
    const fixture = TestBed.createComponent(AdminBookingsComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(repository.getBookings).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 20 }));
    expect(text).toContain('GS123456');
    expect(text).toContain('Goat Arena');
    expect(text).toContain('Khách #player-1');
    expect(fixture.componentInstance.paidAmount(booking)).toBe(60000);
  });

  it('filters by status from the first page and offers no owner actions in the detail', () => {
    const fixture = TestBed.createComponent(AdminBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.goToPage(2);
    fixture.componentInstance.setStatus('CANCELLED');

    expect(repository.getBookings).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'CANCELLED', page: 0 }));

    fixture.componentInstance.open(booking);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Tiền cọc');
    expect(dialog.textContent).toContain('Không thành công');
    expect([...dialog.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['', 'Đóng']);
  });

  it('shows a retryable error when the list fails', () => {
    repository.getBookings.mockReturnValue(throwError(() => ({ error: { message: 'Mất kết nối' } })));
    const fixture = TestBed.createComponent(AdminBookingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Mất kết nối');
  });
});
