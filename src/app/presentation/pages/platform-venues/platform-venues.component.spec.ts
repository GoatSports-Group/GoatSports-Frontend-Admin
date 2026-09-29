import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { PlatformVenuesComponent } from './platform-venues.component';

describe('PlatformVenuesComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: true, district: 'Thủ Đức', city: 'Hồ Chí Minh',
    phone: '0909123456', email: 'arena@goat.test', averageRating: 4.5, totalReviews: 12,
    imageUrls: [], amenities: [], courts: []
  };
  const repository = { getVenues: vi.fn(), suspend: vi.fn(), reinstate: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(async () => {
    repository.getVenues.mockReset().mockReturnValue(of({ items: [venue], total: 1 }));
    repository.suspend.mockReset().mockReturnValue(of({
      ...venue, active: false, suspendedAt: '2026-09-29T10:00:00', suspensionReason: 'Nhiều khiếu nại về an toàn sân'
    }));
    repository.reinstate.mockReset().mockReturnValue(of(venue));
    dialog.open.mockReset().mockReturnValue({ afterClosed: () => of(true) });
    await TestBed.configureTestingModule({
      imports: [PlatformVenuesComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository },
        { provide: MatDialog, useValue: dialog }
      ]
    }).compileComponents();
  });

  it('requires a real reason before suspending and flips the row in place', () => {
    const fixture = TestBed.createComponent(PlatformVenuesComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.openSuspend(venue);
    page.reason.set('ngắn');
    page.confirmSuspend();
    expect(repository.suspend).not.toHaveBeenCalled();

    page.reason.set('  Nhiều khiếu nại về an toàn sân  ');
    page.confirmSuspend();
    fixture.detectChanges();

    expect(repository.suspend).toHaveBeenCalledWith('venue-1', 'Nhiều khiếu nại về an toàn sân');
    expect(page.suspending()).toBeNull();
    expect(page.statusOf(page.items()[0]).label).toBe('Bị đình chỉ');
    expect(fixture.nativeElement.textContent).toContain('Gỡ đình chỉ');
  });

  it('drops a reinstated venue from the "Bị đình chỉ" tab', () => {
    repository.getVenues.mockReturnValue(of({
      items: [{ ...venue, active: false, suspendedAt: '2026-09-29T10:00:00', suspensionReason: 'Vi phạm' }], total: 1
    }));
    const fixture = TestBed.createComponent(PlatformVenuesComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.setStatus('SUSPENDED');

    page.reinstate(page.items()[0]);

    expect(repository.reinstate).toHaveBeenCalledWith('venue-1');
    expect(page.items()).toHaveLength(0);
    expect(page.total()).toBe(0);
  });
});
