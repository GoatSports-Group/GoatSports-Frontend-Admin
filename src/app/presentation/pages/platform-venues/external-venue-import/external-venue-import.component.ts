import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subscription, expand, finalize, switchMap, timer } from 'rxjs';
import {
  ADMIN_VENUE_REPOSITORY_TOKEN, ExternalVenueImportRequest, ExternalVenueImportStatus, ExternalVenueRegionSummary
} from '@application/ports/persistence/admin-venue.repository';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

/** Khung của các thành phố lớn (venue-service nhận tối đa 3 độ mỗi chiều, hỏi Overpass từng ô 0,25 độ). */
const PRESETS: readonly ExternalVenueImportRequest[] = [
  { region: 'TP. Hồ Chí Minh', south: 10.37, west: 106.36, north: 11.16, east: 107.02 },
  { region: 'Hà Nội', south: 20.56, west: 105.28, north: 21.39, east: 106.02 },
  { region: 'Đà Nẵng', south: 15.92, west: 107.9, north: 16.2, east: 108.35 },
  { region: 'Hải Phòng', south: 20.65, west: 106.5, north: 20.95, east: 106.85 },
  { region: 'Cần Thơ', south: 9.9, west: 105.55, north: 10.3, east: 105.9 }
];
const MAX_SPAN_DEGREES = 3;
const TILE_DEGREES = 0.25;
const POLL_MS = 4000;

/**
 * Tab "Sân ngoài hệ thống" của Cơ sở: nhập sân thực tế từ OpenStreetMap theo thành phố có sẵn hoặc một khung tự nhập,
 * để người chơi vẫn tìm được sân khi khu vực đó chưa có cơ sở đối tác. Nhập lại thì cập nhật, không tạo trùng.
 * Trong lúc một đợt chạy, trang hỏi trạng thái mỗi 4 giây và tự tải lại số sân khi xong.
 */
@Component({
  selector: 'app-external-venue-import',
  templateUrl: './external-venue-import.component.html',
  styleUrls: ['./external-venue-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, LucideIconComponent]
})
export class ExternalVenueImportComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;

  readonly presets = PRESETS;
  readonly summaries = signal<ExternalVenueRegionSummary[]>([]);
  readonly status = signal<ExternalVenueImportStatus | null>(null);
  readonly starting = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly custom = signal<{ region: string; south: number | null; west: number | null; north: number | null; east: number | null }>(
    { region: '', south: null, west: null, north: null, east: null });

  readonly running = computed(() => this.status()?.state === 'RUNNING');
  readonly busy = computed(() => this.running() || this.starting() !== null);
  /** Khu vực đã nhập bằng khung tự nhập (không nằm trong danh sách có sẵn). */
  readonly otherRegions = computed(() =>
    this.summaries().filter(summary => !PRESETS.some(preset => preset.region === summary.region)));
  readonly boundsError = computed(() => {
    const { south, west, north, east } = this.custom();
    if ([south, west, north, east].some(value => value === null || !Number.isFinite(value))) return 'Nhập đủ bốn toạ độ.';
    if (south! >= north! || west! >= east!) return 'Nam phải nhỏ hơn Bắc và Tây nhỏ hơn Đông.';
    if (south! < -90 || north! > 90 || west! < -180 || east! > 180) return 'Toạ độ nằm ngoài bản đồ.';
    if (north! - south! > MAX_SPAN_DEGREES || east! - west! > MAX_SPAN_DEGREES) {
      return `Mỗi chiều tối đa ${MAX_SPAN_DEGREES} độ. Tỉnh lớn hơn thì chia thành vài đợt.`;
    }
    return null;
  });
  readonly customError = computed(() => this.custom().region.trim() ? this.boundsError() : 'Nhập tên khu vực.');
  /** Số ô venue-service sẽ hỏi Overpass, để admin ước lượng thời gian. */
  readonly customTiles = computed(() => {
    if (this.boundsError()) return 0;
    const { south, west, north, east } = this.custom();
    return Math.ceil((north! - south!) / TILE_DEGREES) * Math.ceil((east! - west!) / TILE_DEGREES);
  });

  ngOnInit(): void {
    this.refresh();
    this.watchStatus();
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

  progressPercent(status: ExternalVenueImportStatus): number {
    return status.totalTiles ? Math.round(status.doneTiles / status.totalTiles * 100) : 0;
  }

  setCustom(field: 'region' | 'south' | 'west' | 'north' | 'east', value: string | number | null): void {
    this.custom.update(current => ({
      ...current,
      [field]: field === 'region' ? String(value ?? '') : (value === null || value === '' ? null : Number(value))
    }));
  }

  importCustom(): void {
    if (this.customError()) return;
    const { region, south, west, north, east } = this.custom();
    this.startImport({ region: region.trim(), south: south!, west: west!, north: north!, east: east! });
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
