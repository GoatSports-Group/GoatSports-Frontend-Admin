import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideCalendar, LucideCamera, LucideCircleCheck, LucideClock,
  LucideCreditCard, LucideFilePlus2, LucideHash, LucideLandPlot, LucideLoader2,
  LucideReceipt, LucideSearch, LucideShieldCheck, LucideUserCheck, provideLucideIcons
} from '@lucide/angular';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerCheckInResult } from '@application/dto/owner-check-in/owner-check-in.dto';
import { OwnerTimeSlot } from '@application/dto/owner-schedule/owner-schedule.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerCheckInUseCase } from '@application/usecase/owner-check-in/manage-owner-check-in.usecase';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OwnerCheckInComponent } from './owner-check-in.component';

describe('OwnerCheckInComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: true, imageUrls: [], amenities: [], courts: []
  };
  const slot: OwnerTimeSlot = {
    timeSlotId: 'slot-1', venueCourtId: 'court-1', date: '2026-08-30',
    startTime: '08:00:00', endTime: '09:00:00', pricePerHour: 200000, status: 'AVAILABLE'
  };
  const booking: OwnerBooking = {
    bookingId: 'booking-1', playerId: 'player-12345678', venueId: 'venue-1', venueCourtId: 'court-1',
    venueName: 'Goat Arena', courtName: 'Sân A', playDate: '2026-08-30',
    startTime: '08:00:00', endTime: '09:00:00', status: 'CONFIRMED', source: 'DIRECT',
    totalPrice: 200000, depositAmount: 60000, remainingAmount: 140000,
    bookingCode: 'GS123456', createdAt: '2026-08-29T08:00:00',
    payments: [{
      paymentId: 'payment-1', purpose: 'BOOKING_DEPOSIT', amount: 60000, currency: 'VND',
      status: 'SUCCEEDED', paidAt: '2026-08-29T08:05:00', createdAt: '2026-08-29T08:01:00'
    }],
    allowedTransitions: ['CHECKED_IN']
  };
  const lookupResult: OwnerCheckInResult = { booking, outstandingAmount: 140000 };
  const checkedInResult: OwnerCheckInResult = {
    booking: { ...booking, status: 'CHECKED_IN', allowedTransitions: ['COMPLETED'] },
    outstandingAmount: 0,
    checkIn: {
      checkInId: 'check-in-1', paymentId: 'remaining-payment-1', checkedInBy: 'owner-1',
      method: 'BOOKING_CODE', remainingAmountCollected: 140000, checkedInAt: '2026-08-30T08:02:00'
    }
  };
  const emptyHistory = { items: [], page: 0, pageSize: 10, pages: 0, total: 0 };
  const getVenues = { execute: vi.fn() };
  const manageCourts = { list: vi.fn() };
  const manageSchedule = { listSlots: vi.fn() };
  const manageCheckIn = {
    history: vi.fn(), lookup: vi.fn(), confirm: vi.fn(), createWalkIn: vi.fn()
  };
  const notify = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    getVenues.execute.mockReset().mockReturnValue(of([venue]));
    manageCourts.list.mockReset().mockReturnValue(of([{
      venueCourtId: 'court-1', venueId: 'venue-1', name: 'Sân A', sportType: 'BADMINTON',
      capacity: 4, surfaceType: 'PVC', active: true
    }]));
    manageSchedule.listSlots.mockReset().mockReturnValue(of([slot]));
    manageCheckIn.history.mockReset().mockReturnValue(of(emptyHistory));
    manageCheckIn.lookup.mockReset().mockReturnValue(of(lookupResult));
    manageCheckIn.confirm.mockReset().mockReturnValue(of(checkedInResult));
    manageCheckIn.createWalkIn.mockReset().mockReturnValue(of(lookupResult));
    notify.success.mockReset();
    notify.error.mockReset();

    await TestBed.configureTestingModule({
      imports: [OwnerCheckInComponent],
      providers: [
        provideLucideIcons(
          LucideAlertCircle, LucideCalendar, LucideCamera, LucideCircleCheck, LucideClock,
          LucideCreditCard, LucideFilePlus2, LucideHash, LucideLandPlot, LucideLoader2,
          LucideReceipt, LucideSearch, LucideShieldCheck, LucideUserCheck
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues },
        { provide: ManageOwnerVenueCourtsUseCase, useValue: manageCourts },
        { provide: ManageOwnerScheduleUseCase, useValue: manageSchedule },
        { provide: ManageOwnerCheckInUseCase, useValue: manageCheckIn },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('loads the owner-scoped court, available slots and check-in history', () => {
    const fixture = TestBed.createComponent(OwnerCheckInComponent);
    fixture.detectChanges();

    expect(manageCourts.list).toHaveBeenCalledWith('venue-1');
    expect(manageSchedule.listSlots).toHaveBeenCalledWith('court-1', expect.any(String), expect.any(String));
    expect(manageCheckIn.history).toHaveBeenCalledWith(expect.objectContaining({
      venueId: 'venue-1', venueCourtId: 'court-1', page: 0, size: 10
    }));
    expect(fixture.componentInstance.availableSlots()).toEqual([slot]);
    expect(fixture.nativeElement.textContent).toContain('Check-in khách');
  });

  it('renders backend booking and payment data after a booking-code lookup', () => {
    const fixture = TestBed.createComponent(OwnerCheckInComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.lookupForm.controls.value.setValue('GS123456');

    component.lookup();
    fixture.detectChanges();

    expect(manageCheckIn.lookup).toHaveBeenCalledWith({ bookingCode: 'GS123456' });
    expect(component.reconciliation()).toEqual(lookupResult);
    expect(fixture.nativeElement.textContent).toContain('GS123456');
    expect(fixture.nativeElement.textContent).toContain('SUCCEEDED');
  });

  it('clears stale reconciliation on lookup failure and supports retry', () => {
    manageCheckIn.lookup
      .mockReturnValueOnce(of(lookupResult))
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Booking không hợp lệ' } })))
      .mockReturnValueOnce(of(lookupResult));
    const fixture = TestBed.createComponent(OwnerCheckInComponent);
    const component = fixture.componentInstance;
    component.lookupForm.controls.value.setValue('GS123456');

    component.lookup();
    component.lookup();
    expect(component.reconciliation()).toBeNull();
    expect(component.actionError()).toBe('Booking không hợp lệ');

    component.lookup();
    expect(component.actionError()).toBeNull();
    expect(component.reconciliation()).toEqual(lookupResult);
  });

  it('blocks double confirmation while the first request is pending', () => {
    const pending = new Subject<OwnerCheckInResult>();
    manageCheckIn.confirm.mockReturnValue(pending);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(OwnerCheckInComponent);
    const component = fixture.componentInstance;
    component.reconciliation.set(lookupResult);
    component.lookupForm.controls.value.setValue('GS123456');

    component.confirm();
    component.confirm();

    expect(manageCheckIn.confirm).toHaveBeenCalledOnce();
    expect(manageCheckIn.confirm).toHaveBeenCalledWith({
      bookingId: 'booking-1', method: 'BOOKING_CODE', paymentMode: 'CASH',
      qrCode: undefined, bookingCode: 'GS123456'
    });
    expect(component.confirming()).toBe(true);
    confirm.mockRestore();
  });

  it('submits an available walk-in slot once and keeps backend errors visible', () => {
    const pending = new Subject<OwnerCheckInResult>();
    manageCheckIn.createWalkIn.mockReturnValue(pending);
    const fixture = TestBed.createComponent(OwnerCheckInComponent);
    const component = fixture.componentInstance;
    component.walkInForm.setValue({
      timeSlotId: 'slot-1', customerName: 'Nguyễn Văn A', customerPhone: '0901234567'
    });

    component.createWalkIn();
    component.createWalkIn();

    expect(manageCheckIn.createWalkIn).toHaveBeenCalledOnce();
    expect(manageCheckIn.createWalkIn).toHaveBeenCalledWith({
      venueCourtId: 'court-1', timeSlotId: 'slot-1',
      customerName: 'Nguyễn Văn A', customerPhone: '0901234567'
    });
    expect(component.creatingWalkIn()).toBe(true);
  });
});
