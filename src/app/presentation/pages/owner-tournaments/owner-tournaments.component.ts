import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { OwnerTournament } from '@application/dto/owner-tournament/owner-tournament.dto';
import { OWNER_TOURNAMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-tournament.repository';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { OwnerTournamentFormComponent } from './owner-tournament-form.component';
import { FORMAT_LABEL, SPORT_LABEL, STATUS_META, formatVnd } from './tournament-labels';

@Component({
  selector: 'app-owner-tournaments',
  standalone: true,
  imports: [DatePipe, RouterLink, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent, OwnerTournamentFormComponent],
  templateUrl: './owner-tournaments.component.html',
  styleUrl: './owner-tournaments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerTournamentsComponent {
  private readonly repository = inject(OWNER_TOURNAMENT_REPOSITORY_TOKEN);
  private readonly router = inject(Router);

  readonly pageSize = 10;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly statusMeta = STATUS_META;
  readonly formatVnd = formatVnd;

  readonly items = signal<OwnerTournament[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showCreate = signal(false);

  /** KPI tren trang hien tai; du cho chu san it giai, khong can API tong hop rieng. */
  readonly kpis = computed(() => {
    const items = this.items();
    return {
      open: items.filter(item => item.status === 'REGISTRATION_OPEN').length,
      running: items.filter(item => item.status === 'IN_PROGRESS').length,
      seats: items.reduce((sum, item) => sum + item.currentParticipants, 0),
      drafts: items.filter(item => item.status === 'DRAFT').length
    };
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository.getMine(this.pageIndex(), this.pageSize).subscribe({
      next: page => { this.items.set(page.items); this.total.set(page.total); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Không tải được giải đấu của bạn. Kiểm tra kết nối rồi thử lại.'); }
    });
  }

  goToPage(index: number): void { this.pageIndex.set(index); this.load(); }

  onCreated(tournament: OwnerTournament): void {
    this.showCreate.set(false);
    void this.router.navigate(['/admin/tournaments', tournament.tournamentId]);
  }
}
