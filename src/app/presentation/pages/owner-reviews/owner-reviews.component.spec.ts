import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity, LucideAlertCircle, LucideCalendar, LucideChevronLeft,
  LucideChevronRight, LucideClock, LucideFilter, LucideHash, LucideInfo,
  LucideLandPlot, LucideLoader2, LucideMessageSquare, LucideRotateCcw,
  LucideShieldCheck, LucideStar, provideLucideIcons
} from '@lucide/angular';
import { OwnerReviewPage } from '@application/dto/owner-review/owner-review.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetOwnerReviewsUseCase } from '@application/usecase/owner-review/get-owner-reviews.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { OwnerReviewsComponent } from './owner-reviews.component';

describe('OwnerReviewsComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: true, imageUrls: [], amenities: [],
    courts: [{
      venueCourtId: 'court-1', venueId: 'venue-1', name: 'Court 1',
      sportType: 'BADMINTON', capacity: 4, surfaceType: 'WOOD', active: true
    }]
  };
  const page: OwnerReviewPage = {
    items: [{
      reviewId: 'review-1', venueId: 'venue-1', venueName: 'Goat Arena',
      venueCourtId: 'court-1', courtName: 'Court 1', bookingId: 'booking-secret-id',
      bookingCode: 'GS123456', playDate: '2026-08-20', startTime: '18:00:00',
      endTime: '19:00:00', rating: 5, content: 'Sân sạch và đúng giờ',
      status: 'PUBLISHED', createdAt: '2026-08-21T09:30:00'
    }],
    total: 25, page: 0, pageSize: 12, pages: 3
  };
  const getVenues = { execute: vi.fn() };
  const getReviews = { execute: vi.fn() };

  beforeEach(async () => {
    getVenues.execute.mockReset().mockReturnValue(of([venue]));
    getReviews.execute.mockReset().mockReturnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [OwnerReviewsComponent],
      providers: [
        provideLucideIcons(
          LucideActivity, LucideAlertCircle, LucideCalendar, LucideChevronLeft,
          LucideChevronRight, LucideClock, LucideFilter, LucideHash, LucideInfo,
          LucideLandPlot, LucideLoader2, LucideMessageSquare, LucideRotateCcw,
          LucideShieldCheck, LucideStar
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues },
        { provide: GetOwnerReviewsUseCase, useValue: getReviews }
      ]
    }).compileComponents();
  });

  it('loads backend reviews and renders booking context without player identity', () => {
    const fixture = TestBed.createComponent(OwnerReviewsComponent);
    fixture.detectChanges();

    expect(getReviews.execute).toHaveBeenCalledWith(expect.objectContaining({
      venueId: undefined, venueCourtId: undefined, page: 0, size: 12
    }));
    expect(fixture.nativeElement.textContent).toContain('Sân sạch và đúng giờ');
    expect(fixture.nativeElement.textContent).toContain('GS123456');
    expect(fixture.nativeElement.textContent).not.toContain('booking-secret-id');
  });

  it('sends selected Venue, court, rating and date filters unchanged', () => {
    const component = TestBed.createComponent(OwnerReviewsComponent).componentInstance;
    component.selectedVenueId.set('venue-1');
    component.selectedCourtId.set('court-1');
    component.selectedRating.set(4);
    component.fromDate.set('2026-08-01');
    component.toDate.set('2026-08-30');

    component.loadReviews(0);

    expect(getReviews.execute).toHaveBeenLastCalledWith({
      venueId: 'venue-1', venueCourtId: 'court-1', rating: 4,
      fromDate: '2026-08-01', toDate: '2026-08-30', page: 0, size: 12
    });
  });

  it('keeps loading visible and blocks duplicate requests', () => {
    const fixture = TestBed.createComponent(OwnerReviewsComponent);
    const component = fixture.componentInstance;
    const pending = new Subject<OwnerReviewPage>();
    getReviews.execute.mockReturnValue(pending);

    component.loadReviews();
    component.loadReviews();
    fixture.detectChanges();

    expect(getReviews.execute).toHaveBeenCalledTimes(2);
    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.skeleton')).toHaveLength(3);
  });

  it('clears stale reviews on error and retries', () => {
    const component = TestBed.createComponent(OwnerReviewsComponent).componentInstance;
    getReviews.execute.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Review API unavailable' } }))
    );

    component.loadReviews();
    expect(component.reviews()).toEqual([]);
    expect(component.error()).toBe('Review API unavailable');

    getReviews.execute.mockReturnValueOnce(of(page));
    component.retry();
    expect(component.error()).toBeNull();
    expect(component.reviews()).toHaveLength(1);
  });

  it('does not request reviews when owner has no Venue', () => {
    getVenues.execute.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(OwnerReviewsComponent);
    fixture.detectChanges();

    expect(getReviews.execute).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở');
  });

  it('requests the next backend page once', () => {
    const component = TestBed.createComponent(OwnerReviewsComponent).componentInstance;
    component.goToPage(1);
    expect(getReviews.execute).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });
});
