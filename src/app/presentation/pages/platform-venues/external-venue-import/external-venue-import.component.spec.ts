import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../../app-icons';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { ExternalVenueImportComponent } from './external-venue-import.component';

describe('ExternalVenueImportComponent', () => {
  const repository = {
    getExternalVenueSummary: vi.fn(), importExternalVenues: vi.fn(), getExternalVenueImportStatus: vi.fn()
  };

  function create() {
    TestBed.configureTestingModule({
      imports: [ExternalVenueImportComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: ADMIN_VENUE_REPOSITORY_TOKEN, useValue: repository }]
    });
    const fixture = TestBed.createComponent(ExternalVenueImportComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    repository.getExternalVenueImportStatus.mockReturnValue(of(null));
    repository.importExternalVenues.mockReturnValue(of(undefined));
  });

  it('shows how many venues each city has, including areas imported by hand', () => {
    repository.getExternalVenueSummary.mockReturnValue(of([
      { region: 'TP. Hồ Chí Minh', venueCount: 412, lastImportedAt: '2026-10-23T09:00:00' },
      { region: 'Lâm Đồng', venueCount: 37, lastImportedAt: '2026-10-23T10:00:00' }
    ]));
    const fixture = create();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('412 sân');
    expect(text).toContain('Chưa nhập');
    expect(text).toContain('Khu vực tự nhập · 37 sân');

    fixture.componentInstance.startImport(fixture.componentInstance.presets[1]);
    expect(repository.importExternalVenues).toHaveBeenCalledWith(expect.objectContaining({ region: 'Hà Nội' }));
  });

  it('shows the running import and blocks another one', () => {
    repository.getExternalVenueSummary.mockReturnValue(of([]));
    repository.getExternalVenueImportStatus.mockReturnValue(of({
      region: 'TP. Hồ Chí Minh', state: 'RUNNING', doneTiles: 3, totalTiles: 12, failedTiles: 0, savedCount: 85,
      startedAt: '2026-10-23T09:00:00', finishedAt: null
    }));
    const fixture = create();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('ô 3/12');
    expect(fixture.componentInstance.busy()).toBe(true);
    fixture.componentInstance.startImport(fixture.componentInstance.presets[0]);
    expect(repository.importExternalVenues).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('imports a custom area only when its box is valid and at most 3 degrees wide', () => {
    repository.getExternalVenueSummary.mockReturnValue(of([]));
    const page = create().componentInstance;

    page.setCustom('region', 'Lâm Đồng');
    page.setCustom('south', 11.2);
    page.setCustom('west', 107.8);
    page.setCustom('north', 12.2);
    page.setCustom('east', 111.9);
    expect(page.customError()).toContain('tối đa 3 độ');
    page.importCustom();
    expect(repository.importExternalVenues).not.toHaveBeenCalled();

    page.setCustom('east', 108.9);
    expect(page.customError()).toBeNull();
    expect(page.customTiles()).toBe(4 * 5);
    page.importCustom();
    expect(repository.importExternalVenues).toHaveBeenCalledWith(
      { region: 'Lâm Đồng', south: 11.2, west: 107.8, north: 12.2, east: 108.9 });
  });
});
