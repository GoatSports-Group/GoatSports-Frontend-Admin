import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { ADMIN_COMMUNITY_REPOSITORY_TOKEN, AdminClub, AdminTournament } from '@application/ports/persistence/admin-community.repository';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { PlatformCommunityComponent } from './platform-community.component';

describe('PlatformCommunityComponent', () => {
  const club: AdminClub = {
    clubId: 'c-1', name: 'GOAT Cầu Lông', sportType: 'BADMINTON', city: 'Hồ Chí Minh', logoUrl: null, ownerId: 'u-1',
    privacy: 'PUBLIC', disbanded: false, disbandedAt: null, eloRating: 1200, matchCount: 4, createdAt: '2026-09-01T10:00:00', memberCount: 18
  };
  const tournament: AdminTournament = {
    tournamentId: 't-1', name: 'Giải Thu', sportType: 'BADMINTON', format: 'SINGLE_ELIMINATION', status: 'REGISTRATION_OPEN',
    organizerId: 'u-2', venueId: 'v-1', maxParticipants: 16, currentParticipants: 5, entryFee: 100_000, prizePool: null,
    registrationOpenDate: '2026-10-01', registrationCloseDate: '2026-10-15', startDate: '2026-10-20', endDate: '2026-10-21', createdAt: null
  };
  const repository = { getClubs: vi.fn(), getTournaments: vi.fn() };
  const venues = { getVenues: vi.fn() };
  const users = { getSummaries: vi.fn() };

  beforeEach(async () => {
    repository.getClubs.mockReset().mockReturnValue(of({ items: [club], total: 1 }));
    repository.getTournaments.mockReset().mockReturnValue(of({ items: [tournament], total: 1 }));
    venues.getVenues.mockReset().mockReturnValue(of({ items: [{ venueId: 'v-1', name: 'GOAT Arena' }], total: 1 }));
    users.getSummaries.mockReset().mockImplementation((ids: string[]) =>
      of(ids.map(userId => ({ userId, fullName: userId === 'u-1' ? 'Chủ CLB' : 'Chủ sân tổ chức', email: `${userId}@goat.test` }))));
    await TestBed.configureTestingModule({
      imports: [PlatformCommunityComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_COMMUNITY_REPOSITORY_TOKEN, useValue: repository },
        { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: venues },
        { provide: USER_REPOSITORY_TOKEN, useValue: users }
      ]
    }).compileComponents();
  });

  it('lists active clubs first with owner names from one batched lookup', () => {
    const fixture = TestBed.createComponent(PlatformCommunityComponent);
    fixture.detectChanges();

    expect(repository.getClubs).toHaveBeenCalledWith(expect.objectContaining({ state: 'ACTIVE', page: 0 }));
    expect(users.getSummaries).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Chủ CLB');
    expect(fixture.nativeElement.textContent).toContain('18');
  });

  it('resolves tournament venues and organizers by id in batches', () => {
    const fixture = TestBed.createComponent(PlatformCommunityComponent);
    fixture.detectChanges();
    fixture.componentInstance.setTab('tournaments');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(venues.getVenues).toHaveBeenCalledWith({ ids: ['v-1'], page: 0, size: 1 });
    expect(text).toContain('GOAT Arena');
    expect(text).toContain('Chủ sân tổ chức');
    expect(text).toContain('5/16');
    expect(text).toContain('Đang mở đăng ký');
  });
});
