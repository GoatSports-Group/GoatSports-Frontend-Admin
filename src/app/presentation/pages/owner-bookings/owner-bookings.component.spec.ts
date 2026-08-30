import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideArrowRight, LucideChevronLeft, LucideChevronRight,
  LucideCircleCheck, LucideClock, LucideCreditCard, LucideFileText, LucideFilter,
  LucideInbox, LucideLandPlot, LucideSearch, LucideUser, LucideX, provideLucideIcons
} from '@lucide/angular';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OwnerBookingsComponent } from './owner-bookings.component';

describe('OwnerBookingsComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: true, imageUrls: [], amenities: [], courts: []
  };
  const booking: OwnerBooking = {
    bookingId: 'booking-1', playerId: 'player-12345678', venueId: 'venue-1', venueCourtId: 'court-1',
    venueName: 'Goat Arena', courtName: 'Sân A', playDate: '2026-08-29',
    startTime: '08:00:00', endTime: '09:00:00', status: 'CHECKED_IN', source: 'DIRECT',
    totalPrice: 200000, depositAmount: 60000, remainingAmount: 140000,
    bookingCode: 'GS123456', createdAt: '2026-08-28T08:00:00',
    payments: [{
      paymentId: 'payment-1', purpose: 'BOOKING_DEPOSIT', amount: 60000, currency: 'VND',
      status: 'SUCCEEDED', paidAt: '2026-08-28T08:05:00', createdAt: '2026-08-28T08:01:00'
    }],
    allowedTransitions: ['COMPLETED']
  };
  const getVenues = { execute: vi.fn() };
  const manageCourts = { list: vi.fn() };
  const manageBookings = { list: vi.fn(), detail: vi.fn(), updateStatus: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    getVenues.execute.mockReset().mockReturnValue(of([venue]));
    manageCourts.list.mockReset().mockReturnValue(of([{
      venueCourtId: 'court-1', venueId: 'venue-1', name: 'Sân A', sportType: 'BADMINTON',
      capacity: 4, surfaceType: 'PVC', active: true
    }]));
    manageBookings.list.mockReset().mockReturnValue(of({
      items: [booking], page: 0, pageSize: 12, pages: 1, total: 1
    }));
    manageBookings.detail.mockReset().mockReturnValue(of(booking));
    manageBookings.updateStatus.mockReset().mockReturnValue(of({
      ...booking, status: 'COMPLETED', allowedTransitions: []
    }));
    notify.success.mockReset(); notify.error.mockReset();

    await TestBed.configureTestingModule({
      imports: [OwnerBookingsComponent],
      providers: [
        provideLucideIcons(
          LucideAlertCircle, LucideArrowRight, LucideChevronLeft, LucideChevronRight,
          LucideCircleCheck, LucideClock, LucideCreditCard, LucideFileText, LucideFilter,
          LucideInbox, LucideLandPlot, LucideSearch, LucideUser, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues },
        { provide: ManageOwnerVenueCourtsUseCase, useValue: manageCourts },
        { provide: ManageOwnerBookingsUseCase, useValue: manageBookings },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('loads owner-scoped bookings and renders payment source-of-truth status', () => {
    const fixture = TestBed.createComponent(OwnerBookingsComponent);
    fixture.detectChanges();

    expect(manageBookings.list).toHaveBeenCalledWith(expect.objectContaining({
      venueId: 'venue-1', page: 0, size: 12
    }));
    expect(fixture.nativeElement.textContent).toContain('GS123456');
    expect(fixture.nativeElement.textContent).toContain('SUCCEEDED');
    expect(fixture.nativeElement.querySelectorAll('.booking-card')).toHaveLength(1);
  });

  it('keeps loading visible until backend responds', () => {
    const pending = new Subject<any>();
    manageBookings.list.mockReturnValue(pending);
    const fixture = TestBed.createComponent(OwnerBookingsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.loading-grid')).toBeTruthy();
  });

  it('shows real list error and supports retry', () => {
    manageBookings.list.mockReturnValueOnce(throwError(() => ({ error: { message: 'Booking API down' } })));
    const fixture = TestBed.createComponent(OwnerBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.loadError()).toBe('Booking API down');
    manageBookings.list.mockReturnValue(of({ items: [booking], page: 0, pageSize: 12, pages: 1, total: 1 }));
    component.loadBookings();

    expect(component.loadError()).toBeNull();
    expect(component.bookings()).toEqual([booking]);
  });

  it('blocks double status transition while the first request is pending', () => {
    const pending = new Subject<OwnerBooking>();
    manageBookings.updateStatus.mockReturnValue(pending);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(OwnerBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.completeBooking(booking);
    component.completeBooking(booking);

    expect(manageBookings.updateStatus).toHaveBeenCalledOnce();
    expect(component.completingId()).toBe('booking-1');
    confirm.mockRestore();
  });
});
