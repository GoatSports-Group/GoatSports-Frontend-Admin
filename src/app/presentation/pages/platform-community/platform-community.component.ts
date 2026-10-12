import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, Injector, OnInit, computed, inject, signal, viewChild
} from '@angular/core';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { TwoWayWindow } from '@shared/utils/two-way-window';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import {
  ADMIN_COMMUNITY_REPOSITORY_TOKEN, AdminClub, AdminClubMember, AdminTournament, AdminTournamentStatus, ClubRole, ClubState,
  SportType
} from '@application/ports/persistence/admin-community.repository';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { UserDirectoryService } from '@presentation/services/user-directory.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { FORMAT_LABEL, SPORT_LABEL, SPORTS, STATUS_META, formatVnd } from '../owner-tournaments/tournament-labels';

type Tab = 'clubs' | 'tournaments';

const ROLE_META: Readonly<Record<ClubRole, { label: string; tone: string }>> = {
  OWNER: { label: 'Chủ CLB', tone: 'primary' },
  ADMIN: { label: 'Quản trị viên', tone: 'info' },
  MEMBER: { label: 'Thành viên', tone: 'neutral' }
};

const TOURNAMENT_STATUSES: readonly AdminTournamentStatus[] =
  ['REGISTRATION_OPEN', 'PUBLISHED', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

/**
 * CLB và giải đấu toàn sàn (chỉ xem). Club-service chỉ lưu mã chủ CLB / ban tổ chức / cơ sở: tên được tra theo lô,
 * mỗi trang một lần cho người dùng và một lần cho cơ sở. Điều hành giải vẫn là việc của chủ sân tổ chức.
 */
@Component({
  selector: 'app-platform-community',
  templateUrl: './platform-community.component.html',
  styleUrls: ['./platform-community.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent,
    SelectComponent, InfiniteScrollDirective]
})
export class PlatformCommunityComponent implements OnInit {
  private readonly repository = inject(ADMIN_COMMUNITY_REPOSITORY_TOKEN);
  private readonly venues = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly search$ = new Subject<string>();
  readonly users = inject(UserDirectoryService);
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly fee = formatVnd;

  readonly sportOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi môn' }, ...SPORTS.map(value => ({ value, label: SPORT_LABEL[value] }))
  ];
  readonly clubStateOptions: readonly SelectOption[] = [
    { value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'DISBANDED', label: 'Đã giải tán' }, { value: '', label: 'Tất cả' }
  ];
  readonly tournamentStatusOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi trạng thái' }, ...TOURNAMENT_STATUSES.map(value => ({ value, label: STATUS_META[value].label }))
  ];

  readonly tab = signal<Tab>('clubs');
  readonly clubState = signal<ClubState | ''>('ACTIVE');
  readonly tournamentStatus = signal<AdminTournamentStatus | ''>('');
  readonly sport = signal<SportType | ''>('');
  readonly keyword = signal('');
  readonly pageIndex = signal(0);

  readonly clubs = signal<AdminClub[]>([]);
  readonly tournaments = signal<AdminTournament[]>([]);
  readonly venueNames = signal<ReadonlyMap<string, string>>(new Map());
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);

  readonly roleMeta = ROLE_META;
  /** Thành viên tải dần 5 người một lần khi cuộn; chỉ render tối đa 15 (cuộn lên thì nối lại phía trên). */
  readonly memberChunk = 5;
  readonly selectedClub = signal<AdminClub | null>(null);
  readonly members = signal<AdminClubMember[]>([]);
  readonly memberWindow = new TwoWayWindow(this.members, member => member.membershipId, inject(Injector),
    this.memberChunk, this.memberChunk * 3);
  readonly membersTotal = signal(0);
  readonly membersLoading = signal(false);
  readonly membersError = signal<string | null>(null);
  readonly hasMoreMembers = computed(() => this.members().length < this.membersTotal());
  private readonly memberList = viewChild<ElementRef<HTMLElement>>('memberList');
  private membersRequest?: Subscription;

  readonly hasFilters = computed(() => !!(this.sport() || this.keyword()
    || (this.tab() === 'clubs' ? this.clubState() !== 'ACTIVE' : this.tournamentStatus())));

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'tournaments') this.tab.set('tournaments');
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
  }

  setTab(tab: Tab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.keyword.set('');
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'tournaments' ? tab : null }, replaceUrl: true });
    this.reload();
  }

  onKeyword(value: string): void { this.search$.next(value); }

  setSport(value: SportType | ''): void { this.sport.set(value ?? ''); this.reload(); }
  setClubState(value: ClubState | ''): void { this.clubState.set(value ?? ''); this.reload(); }
  setTournamentStatus(value: AdminTournamentStatus | ''): void { this.tournamentStatus.set(value ?? ''); this.reload(); }

  clearFilters(): void {
    this.sport.set('');
    this.keyword.set('');
    this.clubState.set('ACTIVE');
    this.tournamentStatus.set('');
    this.reload();
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  reload(): void {
    this.pageIndex.set(0);
    this.load();
  }

  load(keepList = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    (keepList ? this.paging : this.loading).set(true);
    const base = { sportType: this.sport() || undefined, keyword: this.keyword() || undefined, page: this.pageIndex(), size: this.pageSize };
    const done = () => { this.loading.set(false); this.paging.set(false); };
    const failed = (err: { error?: { message?: string } }) => this.error.set(err?.error?.message ?? 'Không tải được danh sách.');
    if (this.tab() === 'clubs') {
      this.request = this.repository.getClubs({ ...base, state: this.clubState() || undefined })
        .pipe(finalize(done), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: page => {
            this.clubs.set(page.items);
            this.total.set(page.total);
            this.users.resolve(page.items.map(item => item.ownerId));
          },
          error: failed
        });
    } else {
      this.request = this.repository.getTournaments({ ...base, state: this.tournamentStatus() || undefined })
        .pipe(finalize(done), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: page => {
            this.tournaments.set(page.items);
            this.total.set(page.total);
            this.users.resolve(page.items.map(item => item.organizerId));
            this.resolveVenues(page.items.map(item => item.venueId));
          },
          error: failed
        });
    }
  }

  openClub(club: AdminClub): void {
    this.selectedClub.set(club);
    this.members.set([]);
    this.membersTotal.set(0);
    this.memberWindow.reset();
    this.fetchMembers();
  }

  @HostListener('document:keydown.escape')
  closeClub(): void {
    this.membersRequest?.unsubscribe();
    this.selectedClub.set(null);
  }

  /** Chạm đáy: hiện tiếp phần đã tải; hết thì tải 5 người kế tiếp. */
  showMoreMembers(): void {
    if (this.memberWindow.hasAfter()) { this.memberWindow.next(this.memberList()?.nativeElement); return; }
    if (this.hasMoreMembers() && !this.membersLoading()) this.fetchMembers();
  }

  showPreviousMembers(): void {
    this.memberWindow.previous(this.memberList()?.nativeElement);
  }

  fetchMembers(): void {
    const club = this.selectedClub();
    if (!club) return;
    this.membersRequest?.unsubscribe();
    this.membersError.set(null);
    this.membersLoading.set(true);
    // Trang tính theo số đã tải: mỗi trang 5, nối tiếp đúng chỗ dừng.
    const page = Math.floor(this.members().length / this.memberChunk);
    this.membersRequest = this.repository.getClubMembers(club.clubId, page, this.memberChunk)
      .pipe(finalize(() => this.membersLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          const known = new Set(this.members().map(member => member.membershipId));
          const fresh = result.items.filter(member => !known.has(member.membershipId));
          this.members.update(list => [...list, ...fresh]);
          this.membersTotal.set(result.total);
          this.users.resolve(fresh.map(member => member.userId));
          if (page > 0) this.memberWindow.next(this.memberList()?.nativeElement);
        },
        error: err => this.membersError.set(err?.error?.message ?? 'Không tải được danh sách thành viên.')
      });
  }

  person(id: string): string { return this.users.name(id) || 'Đang tải...'; }

  venue(id: string | null): string {
    if (!id) return '—';
    return this.venueNames().get(id) ?? 'Đang tải...';
  }

  tournamentStatusMeta(status: AdminTournamentStatus) { return STATUS_META[status]; }

  seats(item: AdminTournament): string {
    return item.maxParticipants ? `${item.currentParticipants}/${item.maxParticipants}` : `${item.currentParticipants}`;
  }

  private resolveVenues(ids: (string | null)[]): void {
    const missing = [...new Set(ids.filter((id): id is string => !!id && !this.venueNames().has(id)))];
    if (!missing.length) return;
    this.venues.getVenues({ ids: missing, page: 0, size: missing.length })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(page => this.venueNames.update(current => {
        const next = new Map(current);
        page.items.forEach(item => next.set(item.venueId, item.name));
        missing.filter(id => !next.has(id)).forEach(id => next.set(id, 'Cơ sở đã xóa'));
        return next;
      }));
  }
}
