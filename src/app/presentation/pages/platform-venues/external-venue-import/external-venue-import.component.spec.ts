import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { ExternalVenueImportComponent } from './external-venue-import.component';

describe('ExternalVenueImportComponent', () => {
  const repository = { getExternalVenueSummary: vi.fn(), importExternalVenues: vi.fn() };

  function create() {
    TestBed.configureTestingModule({
      imports: [ExternalVenueImportComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository }]
    });
    const fixture = TestBed.createComponent(ExternalVenueImportComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => vi.clearAllMocks());

  it('shows how many venues each imported city has and starts a background import', () => {
    repository.getExternalVenueSummary.mockReturnValue(of([
      { region: 'TP. Hồ Chí Minh', venueCount: 412, lastImportedAt: '2026-10-23T09:00:00' }
    ]));
    repository.importExternalVenues.mockReturnValue(of(undefined));
    const fixture = create();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('412 sân');
    expect(text).toContain('Chưa nhập');

    fixture.componentInstance.startImport(fixture.componentInstance.presets[1]);

    expect(repository.importExternalVenues).toHaveBeenCalledWith(expect.objectContaining({ region: 'Hà Nội' }));
    expect(fixture.componentInstance.notice()).toContain('Hà Nội');
  });

  it('hides itself for staff without the venue management permission', () => {
    repository.getExternalVenueSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = create();

    expect(fixture.nativeElement.querySelector('.external-import')).toBeNull();
  });
});
