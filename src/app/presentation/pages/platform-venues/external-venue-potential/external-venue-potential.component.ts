import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ADMIN_VENUE_REPOSITORY_TOKEN, PotentialVenue } from '@application/ports/persistence/admin-venue.repository';
import { SPORT_LABEL } from '@presentation/pages/community-analytics/community-analytics.utils';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { VenueLocation, VenueLocationModalComponent } from '../venue-location-modal/venue-location-modal.component';

/**
 * Tab "Sân tiềm năng" của Cơ sở: sân ngoài hệ thống người chơi muốn đặt online hoặc đã chơi qua ghép trận, nhiều lượt
 * muốn đặt trước, rồi nhiều kèo, rồi sân có số điện thoại. Đây là danh sách để admin liên hệ mời làm đối tác.
 */
@Component({
  selector: 'app-external-venue-potential',
  templateUrl: './external-venue-potential.component.html',
  styleUrls: ['./external-venue-potential.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideIconComponent, LoadingSkeletonComponent, PaginationComponent, VenueLocationModalComponent]
})
export class ExternalVenuePotentialComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = PAGE_SIZE.table;
  readonly pageIndex = signal(0);
  readonly items = signal<PotentialVenue[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  /** Sân đang xem trên popup bản đồ. */
  readonly locating = signal<VenueLocation | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(paging = false): void {
    this.loading.set(!paging);
    this.paging.set(paging);
    this.error.set(null);
    this.repository.getPotentialVenues(this.pageIndex(), this.pageSize).pipe(
      finalize(() => {
        this.loading.set(false);
        this.paging.set(false);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        this.items.set(page.items);
        this.total.set(page.total);
      },
      error: () => this.error.set('Chưa tải được danh sách sân tiềm năng.')
    });
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  sportsOf(item: PotentialVenue): string {
    return item.venue.sportTypes.map(sport => SPORT_LABEL[sport] ?? sport).join(' · ');
  }

  showOnMap(item: PotentialVenue): void {
    const { name, address, latitude, longitude } = item.venue;
    this.locating.set({ name, address: address ?? item.region, latitude, longitude });
  }
}
