import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { OwnerReview } from '@application/dto/owner-review/owner-review.dto';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { PlatformReviewsComponent } from './platform-reviews.component';

describe('PlatformReviewsComponent', () => {
  const review: OwnerReview = {
    reviewId: 'review-1', venueId: 'venue-1', venueName: 'Goat Arena', venueCourtId: 'court-1', courtName: 'Sân A',
    bookingId: 'booking-1', bookingCode: 'GS123456', playDate: '2026-09-20', startTime: '18:00:00', endTime: '19:00:00',
    rating: 1, content: 'Sân quá tệ', status: 'PUBLISHED', createdAt: '2026-09-21T08:00:00'
  };
  const repository = { getReviews: vi.fn(), moderateReview: vi.fn() };
  const dialog = { open: vi.fn() };
  const queryParams = new BehaviorSubject(convertToParamMap({ venueId: 'venue-1', venueName: 'Goat Arena' }));

  beforeEach(async () => {
    repository.getReviews.mockReset().mockReturnValue(of({ items: [review], page: 0, pageSize: 20, pages: 1, total: 1 }));
    repository.moderateReview.mockReset().mockImplementation((reviewId: string, status: string) => of({ reviewId, status }));
    dialog.open.mockReset().mockReturnValue({ afterClosed: () => of(false) });
    await TestBed.configureTestingModule({
      imports: [PlatformReviewsComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(...APP_ICONS),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams } },
        { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository },
        { provide: MatDialog, useValue: dialog }
      ]
    }).compileComponents();
  });

  it('filters by the venue passed from the venues page', () => {
    const fixture = TestBed.createComponent(PlatformReviewsComponent);
    fixture.detectChanges();

    expect(repository.getReviews).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'venue-1', page: 0 }));
    expect(fixture.nativeElement.textContent).toContain('Goat Arena');
  });

  it('hides straight away but asks before a permanent removal', () => {
    const fixture = TestBed.createComponent(PlatformReviewsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.moderate(review, 'REMOVED');
    expect(dialog.open).toHaveBeenCalled();
    expect(repository.moderateReview).not.toHaveBeenCalled();

    page.moderate(review, 'HIDDEN');
    expect(repository.moderateReview).toHaveBeenCalledWith('review-1', 'HIDDEN');
    expect(page.items()[0].status).toBe('HIDDEN');
  });
});
