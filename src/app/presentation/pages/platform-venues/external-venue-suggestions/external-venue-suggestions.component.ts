import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import {
  ADMIN_VENUE_REPOSITORY_TOKEN, ExternalVenueSuggestion
} from '@application/ports/persistence/admin-venue.repository';
import { SPORT_LABEL } from '@presentation/pages/community-analytics/community-analytics.utils';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { VenueLocation, VenueLocationModalComponent } from '../venue-location-modal/venue-location-modal.component';

/**
 * Tab "Gợi ý sân" của Cơ sở: sân người chơi gợi ý thêm, cũ nhất trước. Duyệt thì sân lên bản đồ (khu vực "Người chơi
 * gợi ý"); từ chối kèm lý do. Mỗi gợi ý kèm các sân đã có trong 150 m để thấy ngay nếu trùng.
 */
@Component({
  selector: 'app-external-venue-suggestions',
  templateUrl: './external-venue-suggestions.component.html',
  styleUrls: ['./external-venue-suggestions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent,
    VenueLocationModalComponent]
})
export class ExternalVenueSuggestionsComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  /** Số gợi ý còn chờ, để trang cha cập nhật huy hiệu trên tab. */
  readonly pendingChange = output<number>();

  readonly pageSize = PAGE_SIZE.rows;
  readonly pageIndex = signal(0);
  readonly items = signal<ExternalVenueSuggestion[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly rejecting = signal<ExternalVenueSuggestion | null>(null);
  readonly rejectReason = signal('');
  /** Gợi ý đang xem trên popup bản đồ. */
  readonly locating = signal<VenueLocation | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository.getExternalVenueSuggestions(this.pageIndex(), this.pageSize).pipe(
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        this.items.set(page.items);
        this.total.set(page.total);
        this.pendingChange.emit(page.total);
      },
      error: () => this.error.set('Chưa tải được danh sách gợi ý sân.')
    });
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load();
  }

  sportsOf(suggestion: ExternalVenueSuggestion): string {
    return suggestion.sportTypes.map(sport => SPORT_LABEL[sport] ?? sport).join(' · ');
  }

  showOnMap(suggestion: ExternalVenueSuggestion): void {
    const { name, address, latitude, longitude } = suggestion;
    this.locating.set({ name, address, latitude, longitude });
  }

  approve(suggestion: ExternalVenueSuggestion): void {
    if (this.busyId()) return;
    this.busyId.set(suggestion.suggestionId);
    this.repository.approveExternalVenueSuggestion(suggestion.suggestionId).pipe(
      finalize(() => this.busyId.set(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.handled(suggestion, `Đã thêm ${suggestion.name} lên bản đồ. Người gợi ý đã được thông báo.`),
      error: (failure: HttpErrorResponse) => this.error.set(failure.error?.message || 'Chưa duyệt được gợi ý này.')
    });
  }

  openReject(suggestion: ExternalVenueSuggestion): void {
    this.rejectReason.set('');
    this.rejecting.set(suggestion);
  }

  closeReject(): void {
    this.rejecting.set(null);
  }

  confirmReject(): void {
    const suggestion = this.rejecting();
    if (!suggestion || this.busyId()) return;
    this.busyId.set(suggestion.suggestionId);
    this.repository.rejectExternalVenueSuggestion(suggestion.suggestionId, this.rejectReason().trim() || null).pipe(
      finalize(() => this.busyId.set(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.rejecting.set(null);
        this.handled(suggestion, `Đã từ chối ${suggestion.name}. Người gợi ý đã được thông báo.`);
      },
      error: (failure: HttpErrorResponse) => this.error.set(failure.error?.message || 'Chưa từ chối được gợi ý này.')
    });
  }

  /** Bỏ gợi ý vừa xử lý khỏi trang; trang trống thì lùi một trang. */
  private handled(suggestion: ExternalVenueSuggestion, message: string): void {
    this.notice.set(message);
    this.items.update(items => items.filter(item => item.suggestionId !== suggestion.suggestionId));
    this.total.update(total => Math.max(0, total - 1));
    this.pendingChange.emit(this.total());
    if (!this.items().length && this.total() > 0) {
      this.pageIndex.set(Math.max(0, this.pageIndex() - 1));
      this.load();
    }
  }
}
