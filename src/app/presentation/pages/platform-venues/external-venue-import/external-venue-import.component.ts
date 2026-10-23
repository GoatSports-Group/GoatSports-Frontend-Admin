import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import {
  ADMIN_VENUE_REPOSITORY_TOKEN, ExternalVenueImportRequest, ExternalVenueRegionSummary
} from '@application/ports/persistence/admin-venue.repository';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

/** Khung của các thành phố lớn (venue-service nhận tối đa 1,5 độ mỗi chiều). */
const PRESETS: readonly ExternalVenueImportRequest[] = [
  { region: 'TP. Hồ Chí Minh', south: 10.37, west: 106.36, north: 11.16, east: 107.02 },
  { region: 'Hà Nội', south: 20.56, west: 105.28, north: 21.39, east: 106.02 },
  { region: 'Đà Nẵng', south: 15.92, west: 107.9, north: 16.2, east: 108.35 },
  { region: 'Hải Phòng', south: 20.65, west: 106.5, north: 20.95, east: 106.85 },
  { region: 'Cần Thơ', south: 9.9, west: 105.55, north: 10.3, east: 105.9 }
];

/**
 * Nhập sân ngoài hệ thống từ OpenStreetMap theo thành phố, để người chơi vẫn tìm được sân thực tế khi khu vực đó chưa
 * có cơ sở đối tác. Nhập lại một thành phố thì cập nhật sân cũ, không tạo trùng. Không có quyền thì ẩn cả khối.
 */
@Component({
  selector: 'app-external-venue-import',
  templateUrl: './external-venue-import.component.html',
  styleUrls: ['./external-venue-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, LucideIconComponent]
})
export class ExternalVenueImportComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  readonly presets = PRESETS;
  readonly allowed = signal(true);
  readonly summaries = signal<ExternalVenueRegionSummary[]>([]);
  readonly starting = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.repository.getExternalVenueSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summaries => this.summaries.set(summaries),
      error: (failure: HttpErrorResponse) => {
        if (failure.status === 403) this.allowed.set(false);
        else this.error.set('Chưa tải được danh sách khu vực đã nhập.');
      }
    });
  }

  summaryOf(region: string): ExternalVenueRegionSummary | undefined {
    return this.summaries().find(summary => summary.region === region);
  }

  startImport(preset: ExternalVenueImportRequest): void {
    this.starting.set(preset.region);
    this.notice.set(null);
    this.error.set(null);
    this.repository.importExternalVenues(preset)
      .pipe(finalize(() => this.starting.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.notice.set(`Đang nhập sân ${preset.region} ở nền, thường mất 1–5 phút. Bấm "Tải lại" để xem kết quả.`),
        error: (failure: HttpErrorResponse) => this.error.set(failure.error?.message || 'Chưa bắt đầu nhập được, thử lại sau.')
      });
  }
}
