import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { ExternalVenuePotentialComponent } from './external-venue-potential.component';

describe('ExternalVenuePotentialComponent', () => {
  it('lists venues players want with their counts and contact', () => {
    const repository = {
      getPotentialVenues: vi.fn(() => of({
        items: [{
          venue: {
            externalVenueId: 'v1', name: 'Sân Quần vợt Thi Sách', sportTypes: ['TENNIS', 'BADMINTON'], latitude: 10.78,
            longitude: 106.7, address: null, phone: null, website: null, openingHours: null, source: 'OSM'
          },
          region: 'TP. Hồ Chí Minh', wantCount: 37, matchCount: 2
        }],
        total: 1, pages: 1
      }))
    };
    TestBed.configureTestingModule({
      imports: [ExternalVenuePotentialComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository }]
    });
    const fixture = TestBed.createComponent(ExternalVenuePotentialComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(repository.getPotentialVenues).toHaveBeenCalledWith(0, 20);
    expect(text).toContain('Sân Quần vợt Thi Sách');
    expect(text).toContain('37');
    expect(text).toContain('Chưa có số');
    expect(text).toContain('TP. Hồ Chí Minh');

    // "Bản đồ" mở popup ngay trên trang, kèm "Chỉ đường" theo toạ độ (sân này không có địa chỉ).
    (fixture.nativeElement.querySelector('.row-action button.btn--ghost') as HTMLButtonElement).click();
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('app-venue-location-modal') as HTMLElement;
    expect(modal.textContent).toContain('Sân Quần vợt Thi Sách');
    expect(modal.querySelectorAll('.modal__footer a')).toHaveLength(1);
    expect(modal.querySelector<HTMLAnchorElement>('a.btn--primary')?.href)
      .toBe('https://www.google.com/maps/dir/?api=1&destination=10.78,106.7');
  });

  it('drafts an invite with the demand, the claim link and an opt-out, and records it once copied', async () => {
    const repository = {
      getPotentialVenues: vi.fn(() => of({
        items: [{
          venue: {
            externalVenueId: 'v1', name: 'Liber Pickleball', sportTypes: ['PICKLEBALL'], latitude: 10.83,
            longitude: 106.69, address: null, phone: '0909 123 456', website: null, openingHours: null, source: 'OSM'
          },
          region: 'TP. Hồ Chí Minh', wantCount: 37, matchCount: 0, inviteCount: 0, lastInvitedAt: null
        }],
        total: 1, pages: 1
      })),
      recordExternalVenueInvite: vi.fn(() => of({ inviteCount: 1, lastInvitedAt: '2026-10-24T09:00:00' }))
    };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
    TestBed.configureTestingModule({
      imports: [ExternalVenuePotentialComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository }]
    });
    const fixture = TestBed.createComponent(ExternalVenuePotentialComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.openInvite(page.items()[0]);
    const message = page.inviteMessage();
    expect(message).toContain('37 người chơi muốn đặt sân online Liber Pickleball');
    expect(message).not.toContain('trận đã được hẹn');
    expect(message).toContain('/claim/v1');
    expect(message).toContain('trả lời "Không"');
    expect(page.zaloUrl(page.items()[0])).toBe('https://zalo.me/0909123456');

    await page.copyInvite();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(message);
    expect(repository.recordExternalVenueInvite).toHaveBeenCalledWith('v1');
    expect(page.items()[0].inviteCount).toBe(1);
  });
});
