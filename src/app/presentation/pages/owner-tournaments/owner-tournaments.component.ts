import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OwnerTournament, OwnerTournamentFilter, OwnerTournamentSummary, TournamentSport, TournamentStatus
} from '@application/dto/owner-tournament/owner-tournament.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OWNER_TOURNAMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-tournament.repository';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { OwnerTournamentFormComponent } from './owner-tournament-form.component';
import { FORMAT_LABEL, SPORTS, SPORT_LABEL, STATUS_META, formatVnd } from './tournament-labels';

/** Thứ tự tab trạng thái: việc cần theo dõi đứng trước, nháp và đã hủy ở cuối. */
const STATUS_TABS: readonly TournamentStatus[] = [
  'REGISTRATION_OPEN', 'PUBLISHED', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'DRAFT', 'CANCELLED'
];

@Component({
  selector: 'app-owner-tournaments',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent,
    OwnerTournamentFormComponent, SelectComponent],
  templateUrl: './owner-tournaments.component.html',
  styleUrl: './owner-tournaments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerTournamentsComponent {
  private readonly repository = inject(OWNER_TOURNAMENT_REPOSITORY_TOKEN);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly pageSize = 10;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly statusMeta = STATUS_META;
  readonly formatVnd = formatVnd;
  readonly statusTabs = STATUS_TABS;

  readonly items = signal<OwnerTournament[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showCreate = signal(false);
  readonly summary = signal<OwnerTournamentSummary | null>(null);
  readonly venues = signal<OwnerVenueOverview[]>([]);

  // Bộ lọc, đồng bộ với URL để quay lại từ trang "Điều hành" vẫn giữ nguyên.
  readonly status = signal<TournamentStatus | ''>('');
  readonly sport = signal<TournamentSport | ''>('');
  readonly venueId = signal('');
  keyword = '';
  private keywordTimer: ReturnType<typeof setTimeout> | undefined;

  readonly hasFilters = computed(() => !!this.status() || !!this.sport() || !!this.venueId() || !!this.appliedKeyword());
  readonly appliedKeyword = signal('');
  readonly sportOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Mọi môn' },
    ...SPORTS.map(sport => ({ value: sport, label: SPORT_LABEL[sport] }))
  ]);
  readonly venueOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Mọi cơ sở' },
    ...this.venues().map(venue => ({ value: venue.venueId, label: venue.name }))
  ]);
  readonly countOf = (status: TournamentStatus) => this.summary()?.byStatus?.[status] ?? 0;

  constructor() {
    const query = this.route.snapshot.queryParamMap;
    const status = query.get('status') as TournamentStatus | null;
    if (status && STATUS_TABS.includes(status)) this.status.set(status);
    const sport = query.get('sport') as TournamentSport | null;
    if (sport && SPORTS.includes(sport)) this.sport.set(sport);
    this.venueId.set(query.get('venue') ?? '');
    this.keyword = query.get('q') ?? '';
    this.appliedKeyword.set(this.keyword.trim());
    this.pageIndex.set(Math.max(0, Number(query.get('page') ?? 1) - 1) || 0);

    this.getVenues.execute().subscribe({ next: venues => this.venues.set(venues), error: () => undefined });
    this.loadSummary();
    this.load();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.keywordTimer));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository.getMine(this.pageIndex(), this.pageSize, this.filter()).subscribe({
      next: page => { this.items.set(page.items); this.total.set(page.total); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Không tải được giải đấu của bạn. Kiểm tra kết nối rồi thử lại.'); }
    });
  }

  setStatus(status: TournamentStatus | ''): void { this.status.set(this.status() === status ? '' : status); this.apply(); }
  setSport(sport: TournamentSport | ''): void { this.sport.set(sport ?? ''); this.apply(); }
  setVenue(venueId: string): void { this.venueId.set(venueId ?? ''); this.apply(); }

  /** Gõ tên: chờ 300ms sau phím cuối mới tải, tránh gọi API mỗi ký tự. */
  onKeyword(value: string): void {
    this.keyword = value;
    clearTimeout(this.keywordTimer);
    this.keywordTimer = setTimeout(() => {
      if (this.keyword.trim() === this.appliedKeyword()) return;
      this.appliedKeyword.set(this.keyword.trim());
      this.apply();
    }, 300);
  }

  clearFilters(): void {
    this.status.set(''); this.sport.set(''); this.venueId.set(''); this.keyword = ''; this.appliedKeyword.set('');
    this.apply();
  }

  goToPage(index: number): void { this.pageIndex.set(index); this.syncUrl(); this.load(); }

  onCreated(tournament: OwnerTournament): void {
    this.showCreate.set(false);
    void this.router.navigate(['/admin/tournaments', tournament.tournamentId]);
  }

  private apply(): void {
    this.pageIndex.set(0);
    this.syncUrl();
    this.load();
  }

  private filter(): OwnerTournamentFilter {
    return {
      status: this.status() || undefined,
      sportType: this.sport() || undefined,
      venueId: this.venueId() || undefined,
      keyword: this.appliedKeyword() || undefined
    };
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true,
      queryParams: {
        status: this.status() || null, sport: this.sport() || null, venue: this.venueId() || null,
        q: this.appliedKeyword() || null, page: this.pageIndex() > 0 ? this.pageIndex() + 1 : null
      }
    });
  }

  private loadSummary(): void {
    this.repository.getSummary().subscribe({ next: summary => this.summary.set(summary), error: () => undefined });
  }
}
