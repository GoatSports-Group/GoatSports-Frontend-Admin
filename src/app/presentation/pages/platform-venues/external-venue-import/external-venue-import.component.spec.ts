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

  it('imports a province picked by name using its own boundary box', () => {
    repository.getExternalVenueSummary.mockReturnValue(of([]));
    const page = create().componentInstance;
    expect(page.customError()).toContain('Tìm tên khu vực');

    page.choosePlace({
      latitude: 11.94, longitude: 108.44, title: 'Tỉnh Lâm Đồng', address: 'Tỉnh Lâm Đồng, Việt Nam',
      bounds: { south: 10.98, west: 107.28, north: 12.84, east: 108.98 }
    });

    expect(page.regionName()).toBe('Tỉnh Lâm Đồng');
    expect(page.customError()).toBeNull();
    expect(page.areaTiles()).toBe(8 * 7);
    page.importCustom();
    expect(repository.importExternalVenues).toHaveBeenCalledWith(
      { region: 'Tỉnh Lâm Đồng', south: 10.98, west: 107.28, north: 12.84, east: 108.98 });
  });

  it('refuses an area wider than 3 degrees', () => {
    repository.getExternalVenueSummary.mockReturnValue(of([]));
    const page = create().componentInstance;
    page.regionName.set('Miền Trung');

    page.chooseArea({ south: 12, west: 106, north: 16.5, east: 109 }, false);
    expect(page.customError()).toContain('rộng hơn 3 độ');
    page.importCustom();

    expect(repository.importExternalVenues).not.toHaveBeenCalled();
  });
});
