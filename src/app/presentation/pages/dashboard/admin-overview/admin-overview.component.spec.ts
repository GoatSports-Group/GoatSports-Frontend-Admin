import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { AdminOverviewComponent } from './admin-overview.component';

describe('AdminOverviewComponent', () => {
  const repository = { getUserStats: vi.fn(), getBookingStats: vi.fn(), getCommunityStats: vi.fn() };
  const bookingStats = {
    fromDate: '2026-09-01', toDate: '2026-09-02', activeVenues: 4, activeCourts: 17, bookings: 10, gmv: 1_500_000,
    bookingsByStatus: { CONFIRMED: 6, COMPLETED: 2, CANCELLED: 1, EXPIRED: 1, PENDING_PAYMENT: 0 },
    byDay: [{ date: '2026-09-01', bookings: 4, gmv: 600_000 }, { date: '2026-09-02', bookings: 6, gmv: 900_000 }],
    topVenues: [{ venueId: 'v1', name: 'Goat Arena', bookings: 7, gmv: 1_000_000 }]
  };

  beforeEach(async () => {
    repository.getUserStats.mockReset().mockReturnValue(throwError(() => new Error('auth down')));
    repository.getBookingStats.mockReset().mockReturnValue(of(bookingStats));
    repository.getCommunityStats.mockReset().mockReturnValue(of({
      activeClubs: 3, disbandedClubs: 0, tournaments: 5, tournamentsByStatus: { REGISTRATION_OPEN: 2, IN_PROGRESS: 1 }
    }));
    await TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [provideRouter([]), provideLucideIcons(...APP_ICONS), { provide: ADMIN_STATS_REPOSITORY_TOKEN, useValue: repository }]
    }).compileComponents();
  });

  it('keeps the other tiles when one service fails and derives the cancel rate', () => {
    const fixture = TestBed.createComponent(AdminOverviewComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Không tải được');
    expect(text).toContain('Goat Arena');
    expect(fixture.componentInstance.cancelRate()).toBe(20);
    expect(fixture.componentInstance.liveTournaments()).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.chart__bar')).toHaveLength(2);
    // Chỉ các trạng thái có đơn mới thành thanh ngang, xếp giảm dần.
    expect(fixture.componentInstance.statusRows().map(row => row.count)).toEqual([6, 2, 1, 1]);
  });

  it('reloads only the ranged stats when the period changes', () => {
    const fixture = TestBed.createComponent(AdminOverviewComponent);
    fixture.detectChanges();
    fixture.componentInstance.setRange(7);

    expect(repository.getBookingStats).toHaveBeenCalledTimes(2);
    expect(repository.getCommunityStats).toHaveBeenCalledTimes(1);
    const [from, to] = repository.getBookingStats.mock.calls[1];
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000).toBe(6);
  });
});
