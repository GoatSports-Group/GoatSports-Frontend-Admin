import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { ADMIN_FINANCE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-finance.repository';
import { SOCIAL_MODERATION_REPOSITORY_TOKEN } from '@application/ports/persistence/social-moderation.repository';
import { SYSTEM_MONITOR_REPOSITORY_TOKEN } from '@application/ports/persistence/system-monitor.repository';
import { AdminOverviewComponent } from './admin-overview.component';

describe('AdminOverviewComponent', () => {
  const stats = { getUserStats: vi.fn(), getBookingStats: vi.fn(), getCommunityStats: vi.fn() };
  const finance = { getSummary: vi.fn() };
  const moderation = { getReportQueue: vi.fn(), getAppealQueue: vi.fn() };
  const monitor = { getServicesHealth: vi.fn() };
  const bookingStats = {
    fromDate: '2026-09-01', toDate: '2026-09-02', activeVenues: 4, activeCourts: 17, bookings: 10, gmv: 1_500_000,
    bookingsByStatus: { CONFIRMED: 6, COMPLETED: 2, CANCELLED: 1, EXPIRED: 1, PENDING_PAYMENT: 0 },
    byDay: [{ date: '2026-09-01', bookings: 4, gmv: 600_000 }, { date: '2026-09-02', bookings: 6, gmv: 900_000 }],
    topVenues: [{ venueId: 'v1', name: 'Goat Arena', bookings: 7, gmv: 1_000_000 }]
  };
  const previousBookingStats = { ...bookingStats, bookings: 8, gmv: 2_000_000, bookingsByStatus: { CONFIRMED: 7, CANCELLED: 1 } };

  beforeEach(async () => {
    stats.getUserStats.mockReset().mockReturnValue(throwError(() => new Error('auth down')));
    // Lần gọi 1: kỳ đang xem, lần 2: kỳ trước.
    stats.getBookingStats.mockReset().mockReturnValueOnce(of(bookingStats)).mockReturnValue(of(previousBookingStats));
    stats.getCommunityStats.mockReset().mockReturnValue(of({
      activeClubs: 3, disbandedClubs: 0, tournaments: 5, tournamentsByStatus: { REGISTRATION_OPEN: 2, IN_PROGRESS: 1 }
    }));
    finance.getSummary.mockReset().mockReturnValue(of({
      from: '2026-09-01', to: '2026-09-30', collected: 3_000_000, platformFee: 150_000, paymentCount: 9, refunded: 0,
      paidOutToOwners: 0, refundsNeedingAttention: 2, payoutsNeedingAttention: 0
    }));
    moderation.getReportQueue.mockReset().mockReturnValue(of({ items: [], total: 5, page: 0, pageSize: 1, pages: 5 }));
    moderation.getAppealQueue.mockReset().mockReturnValue(of({ items: [], total: 0, page: 0, pageSize: 1, pages: 0 }));
    monitor.getServicesHealth.mockReset().mockReturnValue(of({
      checkedAt: '2026-10-12T03:00:00Z', metricsAvailable: true, grafanaUrl: null,
      services: [
        { service: 'venue-service', status: 'UP', requestsPerSecond: 1, errorRate: 0, p95LatencyMs: 80, cpuUsage: 0.1, memoryUsedBytes: 1, uptimeSeconds: 10 },
        { service: 'payment-service', status: 'DOWN', requestsPerSecond: null, errorRate: null, p95LatencyMs: null, cpuUsage: null, memoryUsedBytes: null, uptimeSeconds: null }
      ]
    }));
    await TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_STATS_REPOSITORY_TOKEN, useValue: stats },
        { provide: ADMIN_FINANCE_REPOSITORY_TOKEN, useValue: finance },
        { provide: SOCIAL_MODERATION_REPOSITORY_TOKEN, useValue: moderation },
        { provide: SYSTEM_MONITOR_REPOSITORY_TOKEN, useValue: monitor }
      ]
    }).compileComponents();
  });

  function render(pending: number | null = 3) {
    const fixture = TestBed.createComponent(AdminOverviewComponent);
    fixture.componentRef.setInput('pendingApplications', pending);
    fixture.detectChanges();
    return fixture;
  }

  it('compares the period with the previous one and keeps other blocks when a source fails', () => {
    const fixture = render();
    const page = fixture.componentInstance;
    const [gmv, bookings, users, cancel] = page.kpis();

    expect(bookings.delta).toMatchObject({ tone: 'good', icon: 'trending-up' });
    expect(bookings.delta?.text).toContain('+25');
    expect(gmv.delta).toMatchObject({ tone: 'bad', icon: 'trending-down' });
    expect(gmv.spark).toEqual([600_000, 900_000]);
    // Tỉ lệ hủy 20% so với 12,5% kỳ trước: tăng 7,5 điểm là xấu.
    expect(cancel.value).toBe('20%');
    expect(cancel.delta).toMatchObject({ tone: 'bad' });
    expect(cancel.delta?.text).toContain('7,5 điểm');
    expect(users.error).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Goat Arena');
    expect(fixture.nativeElement.querySelectorAll('.chart__bar')).toHaveLength(2);
    expect(page.statusRows().map(row => row.count)).toEqual([6, 2, 1, 1]);
  });

  it('lists only open work, largest first, each linking to where it is handled', () => {
    const fixture = render(3);
    const page = fixture.componentInstance;

    expect(page.openWork().map(item => [item.key, item.count])).toEqual([
      ['reports', 5], ['applications', 3], ['refunds', 2], ['services', 1]
    ]);
    expect(page.openWorkTotal()).toBe(11);
    const links = [...fixture.nativeElement.querySelectorAll('.queue__list a')].map((a: HTMLAnchorElement) => a.getAttribute('href'));
    expect(links).toContain('/admin/platform-finance?tab=refunds');
    expect(page.healthSummary().tone).toBe('danger');
    expect(page.healthSummary().text).toContain('Thanh toán');
  });

  it('shows the all-clear state when nothing is waiting', () => {
    moderation.getReportQueue.mockReturnValue(of({ items: [], total: 0, page: 0, pageSize: 1, pages: 0 }));
    finance.getSummary.mockReturnValue(of({
      from: '', to: '', collected: 0, platformFee: 0, paymentCount: 0, refunded: 0, paidOutToOwners: 0,
      refundsNeedingAttention: 0, payoutsNeedingAttention: 0
    }));
    monitor.getServicesHealth.mockReturnValue(of({ checkedAt: '', metricsAvailable: true, grafanaUrl: null, services: [] }));
    const fixture = render(0);

    expect(fixture.componentInstance.openWork()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Không có việc tồn đọng');
  });

  it('reloads the current and previous period when the range changes, not the static sources', () => {
    const fixture = render();
    fixture.componentInstance.setRange(7);

    expect(stats.getBookingStats).toHaveBeenCalledTimes(4);
    expect(stats.getCommunityStats).toHaveBeenCalledTimes(1);
    expect(monitor.getServicesHealth).toHaveBeenCalledTimes(1);
    const [from, to] = stats.getBookingStats.mock.calls[2];
    const [previousFrom, previousTo] = stats.getBookingStats.mock.calls[3];
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000).toBe(6);
    expect((new Date(previousTo).getTime() - new Date(previousFrom).getTime()) / 86_400_000).toBe(6);
    expect((new Date(from).getTime() - new Date(previousTo).getTime()) / 86_400_000).toBe(1);
  });
});
