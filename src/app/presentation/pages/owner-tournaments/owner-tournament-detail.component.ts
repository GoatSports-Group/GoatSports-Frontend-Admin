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
import { OwnerTimeSlot } from '@application/dto/owner-schedule/owner-schedule.dto';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
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
  private readonly manageSchedule = inject(ManageOwnerScheduleUseCase);
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
  readonly tab = signal<Tab>(this.initialTab());
  readonly showEdit = signal(false);
  readonly confirm = signal<Confirm | null>(null);
  confirmReason = '';
  scores: Record<string, { score1: number | null; score2: number | null }> = {};
  /** slot là khoá 'HH:mm|HH:mm' của một slot đã sinh ở Lịch và bảng giá. */
  plan = { fixtureId: '', courtId: '', playDate: '', slot: '' };
  readonly courtSlots = signal<OwnerTimeSlot[]>([]);
  readonly courtSlotsLoading = signal(false);
  readonly planKey = signal('');

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
  /**
   * Giờ xếp trận lấy đúng các slot chủ sân đã sinh ở Lịch và bảng giá cho sân + ngày đang chọn, trong khung giải giữ
   * và đủ dài cho một trận. Slot đã có trận khác của giải vẫn hiện nhưng bị khoá để chủ sân thấy lịch đã kín.
   */
  readonly timeOptions = computed<SelectOption[]>(() => {
    this.planKey();
    const t = this.tournament();
    if (!t?.dailyStartTime || !t.dailyEndTime) return [];
    const [open, close] = [minutesOf(t.dailyStartTime), minutesOf(t.dailyEndTime)];
    const minutes = t.matchDurationMinutes ?? 0;
    const taken = this.schedules().filter(item => (item.status === 'CONFIRMED' || item.status === 'PENDING')
      && item.courtId === this.plan.courtId && item.playDate === this.plan.playDate);
    return this.courtSlots()
      .filter(slot => slot.date === this.plan.playDate && slot.status !== 'MAINTENANCE'
        && minutesOf(slot.startTime) >= open && minutesOf(slot.endTime) <= close
        && minutesOf(slot.endTime) - minutesOf(slot.startTime) >= minutes)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(slot => {
        const [start, end] = [minutesOf(slot.startTime), minutesOf(slot.endTime)];
        const busy = taken.some(item => minutesOf(item.startTime) < end && minutesOf(item.endTime) > start);
        const label = `${timeOf(start)} – ${timeOf(end)}`;
        return { value: `${timeOf(start)}|${timeOf(end)}`, label: busy ? `${label} · đã có trận` : label, disabled: busy };
      });
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
    if (!this.plan.playDate) {
      this.plan.playDate = data.tournament.startDate;
      this.loadCourtSlots();
    }
  }

  onPlanChange(field: 'courtId' | 'playDate', value: string): void {
    this.plan[field] = value ?? '';
    this.plan.slot = '';
    this.loadCourtSlots();
  }

  /** Slot của sân trong ngày đã chọn, sinh từ quy tắc giá (venue-service). */
  private loadCourtSlots(): void {
    const { courtId, playDate } = this.plan;
    const key = `${courtId}|${playDate}`;
    this.planKey.set(key);
    if (!courtId || !playDate) { this.courtSlots.set([]); return; }
    this.courtSlotsLoading.set(true);
    this.manageSchedule.listSlots(courtId, playDate, playDate).subscribe({
      next: slots => {
        if (this.planKey() !== key) return;
        this.courtSlots.set(slots);
        this.courtSlotsLoading.set(false);
      },
      error: () => { this.courtSlots.set([]); this.courtSlotsLoading.set(false); }
    });
  }

  /** Lịch của giải đã khép lại hoặc của trận đã có kết quả là lịch sử, không bỏ được. */
  canRelease(item: MatchSchedule): boolean {
    if (this.status() === 'COMPLETED' || this.status() === 'CANCELLED') return false;
    return !this.fixtures().some(fixture => fixture.reservationId === item.reservationId && fixture.status === 'COMPLETED');
  }

  private initialTab(): Tab {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    return tab === 'FIXTURES' || tab === 'SCHEDULE' || tab === 'STANDINGS' ? tab : 'REGISTRATIONS';
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
    if (!t || !this.plan.courtId || !this.plan.playDate || !this.plan.slot) {
      this.notify.warning('Chọn sân, ngày và khung giờ.');
      return;
    }
    const [startTime, endTime] = this.plan.slot.split('|');
    this.run(this.repository.scheduleMatch(this.tournamentId, {
      courtId: this.plan.courtId, fixtureId: this.plan.fixtureId || null, playDate: this.plan.playDate, startTime, endTime
    }), 'Đã xếp sân cho trận.', () => { this.plan.fixtureId = ''; this.plan.slot = ''; });
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
