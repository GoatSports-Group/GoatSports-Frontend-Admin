import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
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
  const venues = {
    getVenues: vi.fn(() => of({ total: 2, items: [
      { venueId: 'v-2', name: 'Sân Tennis Mỹ Đình', courts: [] },
      { venueId: 'v-1', name: 'Goat Arena', courts: [{ venueCourtId: 'c-1', name: 'Sân 1' }, { venueCourtId: 'c-2', name: 'Sân 2' }] }
    ] }))
  };
  const repository = { getBookings: vi.fn(), getBooking: vi.fn(), exportReport: vi.fn(), previewReport: vi.fn() };

  beforeEach(async () => {
    repository.getBookings.mockReset().mockReturnValue(of({ items: [booking], page: 0, pageSize: 20, pages: 1, total: 1 }));
    await TestBed.configureTestingModule({
      imports: [AdminBookingsComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_BOOKING_REPOSITORY_TOKEN, useValue: repository },
        { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: venues }
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

  it('previews the current filter first, then downloads Excel for that same filter', () => {
    repository.previewReport.mockReset().mockReturnValue(of(new Blob(['%PDF'])));
    repository.exportReport.mockReset().mockReturnValue(of(new Blob(['x'])));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    const fixture = TestBed.createComponent(AdminBookingsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.setStatus('CANCELLED');
    page.goToPage(3);

    page.openPreview();
    const filter = { venueId: undefined, venueCourtId: undefined, status: 'CANCELLED', query: undefined, fromDate: undefined, toDate: undefined };
    expect(repository.previewReport).toHaveBeenCalledWith(filter);
    expect(page.previewUrl()).not.toBeNull();

    page.setStatus('COMPLETED');
    page.download('xlsx');
    expect(repository.exportReport).toHaveBeenCalledWith(filter, 'xlsx');

    page.download('pdf');
    expect(repository.exportReport).toHaveBeenCalledTimes(1);
  });

  it('filters by venue, then by one of its courts, and resets the court when the venue changes', () => {
    const fixture = TestBed.createComponent(AdminBookingsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.venueOptions().map(option => option.label)).toEqual(['Tất cả cơ sở', 'Goat Arena', 'Sân Tennis Mỹ Đình']);

    page.setVenue('v-1');
    expect(page.courtOptions().map(option => option.label)).toEqual(['Tất cả sân', 'Sân 1', 'Sân 2']);
    page.setCourt('c-2');
    expect(repository.getBookings).toHaveBeenLastCalledWith(expect.objectContaining({ venueId: 'v-1', venueCourtId: 'c-2', page: 0 }));

    page.setVenue('v-2');
    expect(repository.getBookings).toHaveBeenLastCalledWith(expect.objectContaining({ venueId: 'v-2', venueCourtId: undefined }));
  });

  it('shows a retryable error when the list fails', () => {
    repository.getBookings.mockReturnValue(throwError(() => ({ error: { message: 'Mất kết nối' } })));
    const fixture = TestBed.createComponent(AdminBookingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Mất kết nối');
  });
});
