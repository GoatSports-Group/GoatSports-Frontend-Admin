import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import {
  EligibilityRule, MatchSchedule, OwnerTournament, TournamentFixture, TournamentRegistration, TournamentStanding,
  TournamentStatus
} from '@application/dto/owner-tournament/owner-tournament.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OWNER_TOURNAMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-tournament.repository';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { OwnerTournamentFormComponent } from './owner-tournament-form.component';
import {
  FORMAT_LABEL, HOLDING, PAYMENT_META, REGISTRATION_META, SPORT_LABEL, STATUS_META, formatVnd, minutesOf, timeOf
} from './tournament-labels';

type Tab = 'REGISTRATIONS' | 'FIXTURES' | 'SCHEDULE' | 'STANDINGS';

interface Confirm { title: string; message: string; label: string; danger: boolean; reason?: boolean; run: (reason: string) => void; }

@Component({
  selector: 'app-owner-tournament-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, LucideIconComponent, LoadingSkeletonComponent, OwnerTournamentFormComponent, SelectComponent],
  templateUrl: './owner-tournament-detail.component.html',
  styleUrl: './owner-tournament-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerTournamentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(OWNER_TOURNAMENT_REPOSITORY_TOKEN);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly notify = inject(NotifyService);
  readonly tournamentId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly statusMeta = STATUS_META;
  readonly registrationMeta = REGISTRATION_META;
  readonly paymentMeta = PAYMENT_META;
  readonly formatVnd = formatVnd;

  readonly tournament = signal<OwnerTournament | null>(null);
  readonly registrations = signal<TournamentRegistration[]>([]);
  readonly fixtures = signal<TournamentFixture[]>([]);
  readonly standings = signal<TournamentStanding[]>([]);
  readonly schedules = signal<MatchSchedule[]>([]);
  readonly rules = signal<EligibilityRule[]>([]);
  readonly venue = signal<OwnerVenueOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly tab = signal<Tab>('REGISTRATIONS');
  readonly showEdit = signal(false);
  readonly confirm = signal<Confirm | null>(null);
  confirmReason = '';
  scores: Record<string, { score1: number | null; score2: number | null }> = {};
  plan = { fixtureId: '', courtId: '', playDate: '', startTime: '' };

  readonly holding = computed(() => this.registrations().filter(item => HOLDING.has(item.status)));
  readonly confirmed = computed(() => this.registrations().filter(item => item.status === 'CONFIRMED'));
  readonly awaitingPayment = computed(() => this.registrations().filter(item => item.status === 'PENDING_PAYMENT'));
  readonly feeCollected = computed(() => this.registrations()
    .filter(item => item.paymentStatus === 'SUCCEEDED').reduce((sum, item) => sum + (item.feeAmount ?? 0), 0));
  readonly names = computed(() => new Map(this.registrations().map(item => [item.registrationId,
    item.teamName || (item.type === 'INDIVIDUAL' ? 'Người chơi' : 'Đội')])));
  readonly courtNames = computed(() => new Map((this.venue()?.courts ?? []).map(court => [court.venueCourtId, court.name])));
  readonly tournamentCourts = computed(() => (this.tournament()?.courtIds ?? [])
    .map(id => ({ id, name: this.courtNames().get(id) ?? 'Sân' })));
  readonly rounds = computed(() => {
    const byRound = new Map<number, TournamentFixture[]>();
    for (const fixture of this.fixtures()) byRound.set(fixture.roundNumber, [...(byRound.get(fixture.roundNumber) ?? []), fixture]);
    return [...byRound.entries()].sort(([a], [b]) => a - b)
      .map(([round, items]) => ({ round, name: items[0]?.roundName ?? `Vòng ${round}`,
        fixtures: items.sort((a, b) => a.matchNumber - b.matchNumber) }));
  });
  readonly scheduleOf = computed(() => new Map(this.schedules()
    .filter(item => item.status === 'CONFIRMED' || item.status === 'PENDING').map(item => [item.reservationId, item])));
  readonly unscheduled = computed(() => this.fixtures().filter(item => item.status !== 'COMPLETED'
    && (!item.reservationId || !this.scheduleOf().has(item.reservationId))));
  readonly hasResults = computed(() => this.fixtures().some(item =>
    item.status === 'COMPLETED' && item.registration1Id && item.registration2Id));
  readonly allPlayed = computed(() => this.fixtures().length > 0 && this.fixtures().every(item => item.status === 'COMPLETED'));
  readonly status = computed<TournamentStatus | null>(() => this.tournament()?.status ?? null);
  /** Giai chua bat dau: con tu choi dang ky duoc. Noi dung giai chi sua duoc khi con la ban nhap. */
  readonly notStarted = computed(() => !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(this.status() ?? ''));
  readonly canGenerate = computed(() => !this.hasResults() && this.confirmed().length >= 2
    && !['DRAFT', 'COMPLETED', 'CANCELLED'].includes(this.status() ?? ''));
  /** Gio bat dau cho duoc trong khung thi dau, buoc = thoi luong mot tran. */
  readonly fixtureOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Không gắn trận (giữ trước)' },
    ...this.unscheduled().map(item => ({ value: item.fixtureId, label: this.fixtureLabel(item) }))
  ]);
  readonly courtOptions = computed<SelectOption[]>(() => this.tournamentCourts().map(court => ({ value: court.id, label: court.name })));
  readonly timeOptions = computed<SelectOption[]>(() => this.startTimes().map(time => ({ value: time, label: time })));
  readonly startTimes = computed(() => {
    const t = this.tournament();
    if (!t?.dailyStartTime || !t.dailyEndTime || !t.matchDurationMinutes) return [];
    const times: string[] = [];
    for (let at = minutesOf(t.dailyStartTime); at + t.matchDurationMinutes <= minutesOf(t.dailyEndTime); at += t.matchDurationMinutes) {
      times.push(timeOf(at));
    }
    return times;
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      tournament: this.repository.get(this.tournamentId),
      registrations: this.repository.getRegistrations(this.tournamentId),
      fixtures: this.repository.getFixtures(this.tournamentId),
      standings: this.repository.getStandings(this.tournamentId),
      schedules: this.repository.getSchedules(this.tournamentId),
      rules: this.repository.getRules(this.tournamentId),
      venues: this.getVenues.execute()
    }).subscribe({
      next: data => {
        this.apply(data);
        this.venue.set(data.venues.find(item => item.venueId === data.tournament.venueId) ?? null);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không tải được giải đấu. Giải có thể không thuộc cơ sở của bạn.'); }
    });
  }

  private refresh(): void {
    forkJoin({
      tournament: this.repository.get(this.tournamentId),
      registrations: this.repository.getRegistrations(this.tournamentId),
      fixtures: this.repository.getFixtures(this.tournamentId),
      standings: this.repository.getStandings(this.tournamentId),
      schedules: this.repository.getSchedules(this.tournamentId),
      rules: this.repository.getRules(this.tournamentId)
    }).subscribe({ next: data => this.apply(data), error: () => this.notify.error('Không tải lại được dữ liệu giải.') });
  }

  private apply(data: { tournament: OwnerTournament; registrations: TournamentRegistration[]; fixtures: TournamentFixture[];
                        standings: TournamentStanding[]; schedules: MatchSchedule[]; rules: EligibilityRule[] }): void {
    this.tournament.set(data.tournament);
    this.registrations.set(data.registrations);
    this.fixtures.set(data.fixtures);
    this.standings.set(data.standings);
    this.schedules.set(data.schedules);
    this.rules.set(data.rules);
    this.scores = Object.fromEntries(data.fixtures.map(item => [item.fixtureId,
      { score1: item.score1 ?? null, score2: item.score2 ?? null }]));
    if (!this.plan.playDate) this.plan.playDate = data.tournament.startDate;
  }

  acceptedCount(registration: TournamentRegistration): number {
    return registration.lineups.filter(row => row.memberStatus === 'ACCEPTED').length || (registration.type === 'INDIVIDUAL' ? 1 : 0);
  }

  schedule(fixture: TournamentFixture): MatchSchedule | undefined {
    return fixture.reservationId ? this.scheduleOf().get(fixture.reservationId) : undefined;
  }

  fixtureLabel(fixture: TournamentFixture): string {
    const name = (id?: string) => id ? this.names().get(id) ?? 'Đội' : 'Chờ xác định';
    return `${fixture.roundName} · Trận ${fixture.matchNumber}: ${name(fixture.registration1Id)} – ${name(fixture.registration2Id)}`;
  }

  // ---- hanh dong ----

  publish(): void {
    this.run(this.repository.changeStatus(this.tournamentId, 'PUBLISHED'), 'Đã công bố giải và giữ sân.');
  }

  askGenerate(): void {
    const pending = this.holding().length - this.confirmed().length;
    this.openConfirm({
      title: 'Xếp lịch thi đấu?', label: 'Xếp lịch', danger: false,
      message: `Lịch sinh từ ${this.confirmed().length} đăng ký đã xác nhận; giải chuyển sang "Đang diễn ra".`
        + (pending ? ` ${pending} đăng ký chưa đủ người hoặc chưa đóng phí sẽ bị đóng.` : ''),
      run: () => this.run(this.repository.generateFixtures(this.tournamentId), 'Đã xếp lịch thi đấu.', () => this.tab.set('FIXTURES'))
    });
  }

  askComplete(): void {
    this.openConfirm({
      title: 'Kết thúc giải?', label: 'Kết thúc giải', danger: false,
      message: 'Kết quả được chốt và các ngày giữ sân còn lại được trả cho người chơi đặt.',
      run: () => this.run(this.repository.changeStatus(this.tournamentId, 'COMPLETED'), 'Giải đấu đã kết thúc.')
    });
  }

  askCancel(): void {
    this.openConfirm({
      title: 'Hủy giải đấu?', label: 'Hủy giải', danger: true,
      message: 'Sân đã giữ được trả lại, mọi đăng ký bị đóng và hệ thống tự gửi yêu cầu hoàn lệ phí cho người đã đóng. Không thể hoàn tác.',
      run: () => this.run(this.repository.changeStatus(this.tournamentId, 'CANCELLED'), 'Đã hủy giải đấu.')
    });
  }

  askReject(registration: TournamentRegistration): void {
    this.openConfirm({
      title: `Từ chối ${this.names().get(registration.registrationId)}?`, label: 'Từ chối', danger: true, reason: true,
      message: registration.paymentStatus === 'SUCCEEDED'
        ? 'Lệ phí đã thu sẽ được tự động yêu cầu hoàn. Người đăng ký thấy lý do bạn nhập.'
        : 'Người đăng ký thấy lý do bạn nhập.',
      run: reason => this.run(this.repository.reject(this.tournamentId, registration.registrationId, reason), 'Đã từ chối đăng ký.')
    });
  }

  saveScore(fixture: TournamentFixture): void {
    const value = this.scores[fixture.fixtureId];
    const [a, b] = [Number(value?.score1), Number(value?.score2)];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) { this.notify.warning('Nhập tỷ số là số nguyên không âm.'); return; }
    if (this.tournament()?.format === 'SINGLE_ELIMINATION' && a === b) { this.notify.warning('Loại trực tiếp phải có đội thắng.'); return; }
    this.run(this.repository.updateScore(this.tournamentId, fixture.fixtureId, a, b), 'Đã lưu tỷ số.');
  }

  scheduleMatch(): void {
    const t = this.tournament();
    if (!t || !this.plan.courtId || !this.plan.playDate || !this.plan.startTime) {
      this.notify.warning('Chọn sân, ngày và giờ bắt đầu.');
      return;
    }
    const end = timeOf(minutesOf(this.plan.startTime) + (t.matchDurationMinutes ?? 60));
    this.run(this.repository.scheduleMatch(this.tournamentId, {
      courtId: this.plan.courtId, fixtureId: this.plan.fixtureId || null, playDate: this.plan.playDate,
      startTime: this.plan.startTime, endTime: end
    }), 'Đã xếp sân cho trận.', () => { this.plan.fixtureId = ''; this.plan.startTime = ''; });
  }

  releaseSchedule(item: MatchSchedule): void {
    this.run(this.repository.releaseSchedule(this.tournamentId, item.reservationId), 'Đã bỏ lịch sân.');
  }

  onEdited(): void { this.showEdit.set(false); this.refresh(); }

  runConfirm(): void { const state = this.confirm(); if (state && !this.busy()) state.run(this.confirmReason.trim()); }

  closeConfirm(): void { if (!this.busy()) this.confirm.set(null); }

  private openConfirm(state: Confirm): void { this.confirmReason = ''; this.confirm.set(state); }

  private run(request: Observable<unknown>, success: string, after?: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    request.subscribe({
      next: () => { this.busy.set(false); this.confirm.set(null); after?.(); this.notify.success(success); this.refresh(); },
      error: error => { this.busy.set(false); this.notify.error(error?.error?.message ?? 'Không thực hiện được thao tác.'); }
    });
  }
}
