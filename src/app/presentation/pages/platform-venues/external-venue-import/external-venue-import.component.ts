import {
  AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, Subscription, catchError, debounceTime, distinctUntilChanged, expand, finalize, of, switchMap, timer } from 'rxjs';
import {
  ADMIN_VENUE_REPOSITORY_TOKEN, ExternalVenue, ExternalVenueImportRequest, ExternalVenueImportStatus,
  ExternalVenueRegionSummary, PlaceSearchResult
} from '@application/ports/persistence/admin-venue.repository';
import { SPORT_LABEL } from '@presentation/pages/community-analytics/community-analytics.utils';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { InfiniteScrollDirective, LIST_CHUNK } from '@shared/directives/infinite-scroll.directive';
import { loadLeaflet } from '@shared/utils/leaflet-loader';

type Area = Omit<ExternalVenueImportRequest, 'region'>;

/** Một dòng khu vực: thành phố có sẵn (có nút Nhập) hoặc khu vực đã nhập tay. */
export interface RegionRow {
  region: string;
  preset: ExternalVenueImportRequest | null;
  summary: ExternalVenueRegionSummary | undefined;
}

/** Khung của các thành phố lớn (venue-service nhận tối đa 3 độ mỗi chiều, hỏi Overpass từng ô 0,25 độ). */
const PRESETS: readonly ExternalVenueImportRequest[] = [
  { region: 'TP. Hồ Chí Minh', south: 10.37, west: 106.36, north: 11.16, east: 107.02 },
  { region: 'Hà Nội', south: 20.56, west: 105.28, north: 21.39, east: 106.02 },
  { region: 'Đà Nẵng', south: 15.92, west: 107.9, north: 16.2, east: 108.35 },
  { region: 'Hải Phòng', south: 20.65, west: 106.5, north: 20.95, east: 106.85 },
  { region: 'Cần Thơ', south: 9.9, west: 105.55, north: 10.3, east: 105.9 }
];
const MAX_SPAN_DEGREES = 3;
const POLL_MS = 4000;
const VENUE_PAGE_SIZE = PAGE_SIZE.streamLight;
const VIETNAM_CENTER: [number, number] = [16.0, 106.5];

/**
 * Tab "Sân ngoài hệ thống" của Cơ sở: nhập sân thực tế từ OpenStreetMap theo thành phố có sẵn hoặc một vùng chọn trên
 * bản đồ, để người chơi vẫn tìm được sân khi khu vực đó chưa có cơ sở đối tác. Nhập lại thì cập nhật, không tạo trùng.
 * Vùng chọn: tìm tên tỉnh / thành / quận (lấy khung bao của địa danh) hoặc kéo bản đồ rồi "Dùng khung đang xem".
 * Trong lúc một đợt chạy, trang hỏi trạng thái mỗi 4 giây và tự tải lại số sân khi xong.
 */
@Component({
  selector: 'app-external-venue-import',
  templateUrl: './external-venue-import.component.html',
  styleUrls: ['./external-venue-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, InfiniteScrollDirective]
})
export class ExternalVenueImportComponent implements OnInit, AfterViewInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('areaMap');
  private readonly placeQuery$ = new Subject<string>();
  private polling?: Subscription;
  private map: any;
  private areaLayer: any;
  private venuesRequest?: Subscription;
  private venuesPage = -1;

  readonly presets = PRESETS;
  readonly summaries = signal<ExternalVenueRegionSummary[]>([]);
  readonly status = signal<ExternalVenueImportStatus | null>(null);
  readonly starting = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly regionName = signal('');
  readonly area = signal<Area | null>(null);
  readonly placeQuery = signal('');
  readonly places = signal<PlaceSearchResult[]>([]);
  readonly searchingPlaces = signal(false);

  /** Danh sách khu vực render dần từng `LIST_CHUNK` dòng trong khung cuộn. */
  readonly shownRegions = signal(LIST_CHUNK);
  readonly viewing = signal<RegionRow | null>(null);
  readonly venues = signal<ExternalVenue[]>([]);
  readonly venuesTotal = signal(0);
  readonly venuesLoading = signal(false);
  readonly venuesHasMore = signal(false);
  readonly venuesError = signal<string | null>(null);

  readonly running = computed(() => this.status()?.state === 'RUNNING');
  readonly busy = computed(() => this.running() || this.starting() !== null);
  /** Khu vực đã nhập bằng khung tự nhập (không nằm trong danh sách có sẵn). */
  readonly otherRegions = computed(() =>
    this.summaries().filter(summary => !PRESETS.some(preset => preset.region === summary.region)));
  readonly regionRows = computed<RegionRow[]>(() => [
    ...PRESETS.map(preset => ({ region: preset.region, preset, summary: this.summaryOf(preset.region) })),
    ...this.otherRegions().map(summary => ({ region: summary.region, preset: null, summary }))
  ]);
  readonly areaError = computed(() => {
    const area = this.area();
    if (!area) return 'Tìm tên khu vực hoặc kéo bản đồ tới khu vực rồi bấm "Dùng khung đang xem".';
    if (area.north - area.south > MAX_SPAN_DEGREES || area.east - area.west > MAX_SPAN_DEGREES) {
      return `Vùng đã chọn rộng hơn ${MAX_SPAN_DEGREES} độ. Phóng to bản đồ rồi chọn từng phần.`;
    }
    return null;
  });
  readonly customError = computed(() => this.areaError() ?? (this.regionName().trim() ? null : 'Đặt tên cho khu vực.'));

  ngOnInit(): void {
    this.refresh();
    this.watchStatus();
    this.placeQuery$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 3) return of([]);
        this.searchingPlaces.set(true);
        return this.repository.searchPlaces(query).pipe(
          catchError(() => of([])),
          finalize(() => this.searchingPlaces.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(places => this.places.set(places));
  }

  ngAfterViewInit(): void {
    void loadLeaflet().then(L => {
      const element = this.mapElement()?.nativeElement;
      if (!element || this.map) return;
      this.map = L.map(element, { zoomControl: true }).setView(VIETNAM_CENTER, 6);
      L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);
      this.drawArea();
    });
    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  refresh(): void {
    this.repository.getExternalVenueSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summaries => this.summaries.set(summaries),
      error: () => this.error.set('Chưa tải được danh sách khu vực đã nhập.')
    });
  }

  summaryOf(region: string): ExternalVenueRegionSummary | undefined {
    return this.summaries().find(summary => summary.region === region);
  }

  showMoreRegions(): void {
    this.shownRegions.update(shown => shown + LIST_CHUNK);
  }

  /** Mở danh sách sân đã nhập của khu vực (chỉ khi đã nhập). */
  openRegion(row: RegionRow): void {
    if (!row.summary) return;
    this.venuesRequest?.unsubscribe();
    this.viewing.set(row);
    this.venues.set([]);
    this.venuesTotal.set(row.summary.venueCount);
    this.venuesPage = -1;
    this.venuesError.set(null);
    this.loadVenues();
  }

  closeRegion(): void {
    this.venuesRequest?.unsubscribe();
    this.viewing.set(null);
  }

  loadMoreVenues(): void {
    if (this.venuesLoading() || !this.venuesHasMore()) return;
    this.loadVenues();
  }

  sportsOf(venue: ExternalVenue): string {
    return venue.sportTypes.map(sport => SPORT_LABEL[sport] ?? sport).join(' · ');
  }

  progressPercent(status: ExternalVenueImportStatus): number {
    return status.totalTiles ? Math.round(status.doneTiles / status.totalTiles * 100) : 0;
  }

  searchPlace(query: string): void {
    this.placeQuery.set(query);
    this.placeQuery$.next(query.trim());
  }

  /** Chọn một địa danh: lấy khung bao của nó (tỉnh, quận...), không có thì khung ~10 km quanh điểm. */
  choosePlace(place: PlaceSearchResult): void {
    const area = place.bounds ?? {
      south: place.latitude - 0.05, west: place.longitude - 0.05,
      north: place.latitude + 0.05, east: place.longitude + 0.05
    };
    this.regionName.set(place.title);
    this.places.set([]);
    this.chooseArea(area, true);
  }

  /** Vùng nhập là đúng phần bản đồ đang hiện. */
  useMapView(): void {
    if (!this.map) return;
    const view = this.map.getBounds();
    this.chooseArea({ south: view.getSouth(), west: view.getWest(), north: view.getNorth(), east: view.getEast() }, false);
  }

  chooseArea(area: Area, fit: boolean): void {
    const round = (value: number) => Math.round(value * 10_000) / 10_000;
    this.area.set({ south: round(area.south), west: round(area.west), north: round(area.north), east: round(area.east) });
    this.drawArea();
    if (fit && this.map) this.map.fitBounds([[area.south, area.west], [area.north, area.east]], { padding: [24, 24] });
  }

  importCustom(): void {
    const area = this.area();
    if (this.customError() || !area) return;
    this.startImport({ region: this.regionName().trim(), ...area });
  }

  private loadVenues(): void {
    const row = this.viewing();
    if (!row) return;
    const page = this.venuesPage + 1;
    this.venuesLoading.set(true);
    this.venuesRequest = this.repository.getExternalVenuesByRegion(row.region, page, VENUE_PAGE_SIZE).pipe(
      finalize(() => this.venuesLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.venuesPage = page;
        const known = new Set(this.venues().map(venue => venue.externalVenueId));
        this.venues.update(list => [...list, ...result.items.filter(venue => !known.has(venue.externalVenueId))]);
        this.venuesTotal.set(result.total);
        this.venuesHasMore.set(page + 1 < result.pages);
      },
      error: () => {
        this.venuesHasMore.set(false);
        this.venuesError.set('Chưa tải được danh sách sân.');
      }
    });
  }

  private drawArea(): void {
    const L = (window as any).L;
    const area = this.area();
    if (!this.map || !L) return;
    this.areaLayer?.remove();
    this.areaLayer = area
      ? L.rectangle([[area.south, area.west], [area.north, area.east]], {
        color: this.areaError() ? '#b42318' : '#047857', weight: 2, fillOpacity: 0.08
      }).addTo(this.map)
      : null;
  }

  startImport(request: ExternalVenueImportRequest): void {
    if (this.busy()) return;
    this.starting.set(request.region);
    this.error.set(null);
    this.repository.importExternalVenues(request)
      .pipe(finalize(() => this.starting.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.watchStatus(),
        error: (failure: HttpErrorResponse) => this.error.set(failure.error?.message || 'Chưa bắt đầu nhập được, thử lại sau.')
      });
  }

  /** Hỏi trạng thái ngay, rồi mỗi 4 giây cho tới khi đợt nhập xong; xong thì tải lại số sân. */
  private watchStatus(): void {
    this.polling?.unsubscribe();
    const fetchStatus = () => this.repository.getExternalVenueImportStatus();
    this.polling = fetchStatus().pipe(
      expand(status => status?.state === 'RUNNING' ? timer(POLL_MS).pipe(switchMap(fetchStatus)) : EMPTY),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: status => {
        const wasRunning = this.running();
        this.status.set(status);
        if (wasRunning && status?.state !== 'RUNNING') this.refresh();
      },
      error: () => this.error.set('Chưa đọc được trạng thái nhập.')
    });
  }
}
