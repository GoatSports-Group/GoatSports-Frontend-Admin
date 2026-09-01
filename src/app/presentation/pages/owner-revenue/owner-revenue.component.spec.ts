import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideCalendar, LucideCircleCheck, LucideCreditCard,
  LucideFileText, LucideFilter, LucideInbox, LucideInfo, LucideLandPlot,
  LucideLoader2, LucideReceipt, LucideRotateCcw, LucideShieldCheck,
  LucideTrendingDown, LucideTrendingUp, provideLucideIcons
} from '@lucide/angular';
import { OwnerRevenueReport } from '@application/dto/owner-revenue/owner-revenue.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { OwnerRevenueComponent } from './owner-revenue.component';

describe('OwnerRevenueComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: true,
    imageUrls: [], amenities: [], courts: []
  };
  const report: OwnerRevenueReport = {
    scopeVenueId: 'venue-1', currency: 'VND', periodBasis: 'BOOKING_PLAY_DATE',
    currentPeriod: {
      fromDate: '2026-08-01', toDate: '2026-08-30', bookingCount: 3,
      paidBookingCount: 2, totalRevenue: 320000
    },
    previousPeriod: {
      fromDate: '2026-07-02', toDate: '2026-07-31', bookingCount: 2,
      paidBookingCount: 1, totalRevenue: 200000
    },
    revenueChangePercentage: 60,
    bookingCountChangePercentage: 50,
    paymentStatusBreakdown: [
      { status: 'PENDING', paymentCount: 1, nominalAmount: 140000 },
      { status: 'SUCCEEDED', paymentCount: 2, nominalAmount: 320000 }
    ],
    dailyRevenue: [
      { date: '2026-08-01', revenue: 120000, succeededPaymentCount: 1 },
      { date: '2026-08-02', revenue: 200000, succeededPaymentCount: 1 }
    ],
    hourlyRevenue: []
  };
  const getVenues = { execute: vi.fn() };
  const getRevenue = { execute: vi.fn() };

  beforeEach(async () => {
    getVenues.execute.mockReset().mockReturnValue(of([venue]));
    getRevenue.execute.mockReset().mockReturnValue(of(report));

    await TestBed.configureTestingModule({
      imports: [OwnerRevenueComponent],
      providers: [
        provideLucideIcons(
          LucideAlertCircle, LucideCalendar, LucideCircleCheck, LucideCreditCard,
          LucideFileText, LucideFilter, LucideInbox, LucideInfo, LucideLandPlot,
          LucideLoader2, LucideReceipt, LucideRotateCcw, LucideShieldCheck,
          LucideTrendingDown, LucideTrendingUp
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues },
        { provide: GetOwnerRevenueUseCase, useValue: getRevenue }
      ]
    }).compileComponents();
  });

  it('loads real owner revenue and renders source-of-truth metrics', () => {
    const fixture = TestBed.createComponent(OwnerRevenueComponent);
    fixture.detectChanges();

    expect(getRevenue.execute).toHaveBeenCalledWith(expect.objectContaining({
      venueId: undefined, fromDate: expect.any(String), toDate: expect.any(String)
    }));
    expect(fixture.nativeElement.textContent).toContain('320.000');
    expect(fixture.nativeElement.textContent).toContain('Thành công');
    expect(fixture.nativeElement.querySelectorAll('.bar-item')).toHaveLength(2);
  });

  it('uses the full current calendar month as the default revenue period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12));

    try {
      TestBed.createComponent(OwnerRevenueComponent);

      expect(getRevenue.execute).toHaveBeenCalledWith({
        venueId: undefined,
        fromDate: '2026-09-01',
        toDate: '2026-09-30'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps loading visible and blocks duplicate filter requests', () => {
    const fixture = TestBed.createComponent(OwnerRevenueComponent);
    const component = fixture.componentInstance;
    const pending = new Subject<OwnerRevenueReport>();
    getRevenue.execute.mockReturnValue(pending);

    component.loadReport();
    component.loadReport();
    fixture.detectChanges();

    expect(getRevenue.execute).toHaveBeenCalledTimes(2);
    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.loading-grid')).toBeTruthy();
  });

  it('clears stale data on failure and retries the backend request', () => {
    const fixture = TestBed.createComponent(OwnerRevenueComponent);
    const component = fixture.componentInstance;
    expect(component.report()).toEqual(report);
    getRevenue.execute.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Payment service unavailable' } }))
    );

    component.loadReport();
    expect(component.report()).toBeNull();
    expect(component.error()).toBe('Payment service unavailable');

    getRevenue.execute.mockReturnValueOnce(of(report));
    component.retry();
    expect(component.error()).toBeNull();
    expect(component.report()).toEqual(report);
  });

  it('does not call revenue API when the owner has no venue', () => {
    getVenues.execute.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(OwnerRevenueComponent);
    fixture.detectChanges();

    expect(getRevenue.execute).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở');
  });

  it('sends selected venue and date range without changing backend values', () => {
    const fixture = TestBed.createComponent(OwnerRevenueComponent);
    const component = fixture.componentInstance;
    component.selectedVenueId.set('venue-1');
    component.fromDate.set('2026-08-01');
    component.toDate.set('2026-08-30');

    component.loadReport();

    expect(getRevenue.execute).toHaveBeenLastCalledWith({
      venueId: 'venue-1', fromDate: '2026-08-01', toDate: '2026-08-30'
    });
  });
});
