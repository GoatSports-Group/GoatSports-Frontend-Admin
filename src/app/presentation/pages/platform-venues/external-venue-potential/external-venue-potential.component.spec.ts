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

    // "Bản đồ" mở popup ngay trên trang, kèm link Google Maps theo toạ độ (sân này không có địa chỉ).
    (fixture.nativeElement.querySelector('.row-action button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('app-venue-location-modal') as HTMLElement;
    expect(modal.textContent).toContain('Sân Quần vợt Thi Sách');
    expect(modal.querySelector<HTMLAnchorElement>('a.btn--primary')?.href)
      .toBe('https://www.google.com/maps/search/?api=1&query=10.78,106.7');
  });
});
