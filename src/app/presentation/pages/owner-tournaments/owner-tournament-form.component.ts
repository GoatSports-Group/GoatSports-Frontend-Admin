import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EligibilityRule, EligibilityRuleType, OwnerTournament, PlayFormat, TournamentSport, TournamentUpsert
} from '@application/dto/owner-tournament/owner-tournament.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OWNER_TOURNAMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-tournament.repository';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { FORMAT_LABEL, SPORTS, SPORT_LABEL, addDays, capacity, isoDate } from './tournament-labels';

type Errors = Partial<Record<'name' | 'venue' | 'courts' | 'window' | 'size' | 'dates' | 'format', string>>;

const RULE_TYPES: ReadonlyArray<SelectOption & { value: EligibilityRuleType }> = [
  { value: 'AGE', label: 'Độ tuổi' }, { value: 'GENDER', label: 'Giới tính' },
  { value: 'SKILL_LEVEL', label: 'Trình độ' }, { value: 'ELO_RATING', label: 'Điểm ELO' }
];

/**
 * Tao / sua giai cua chu san. Chi chon duoc co so cua chinh minh va san cung mon; server van kiem
 * lai (venue-service), form chi bao truoc de khong phai doi loi.
 */
@Component({
  selector: 'app-owner-tournament-form',
  standalone: true,
  imports: [FormsModule, LucideIconComponent, SelectComponent],
  templateUrl: './owner-tournament-form.component.html',
  styleUrl: './owner-tournament-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerTournamentFormComponent implements OnInit {
  private readonly repository = inject(OWNER_TOURNAMENT_REPOSITORY_TOKEN);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly notify = inject(NotifyService);

  @Input() tournament: OwnerTournament | null = null;
  @Input() rules: readonly EligibilityRule[] = [];
  @Output() readonly saved = new EventEmitter<OwnerTournament>();
  @Output() readonly closed = new EventEmitter<void>();

  readonly sports = SPORTS;
  readonly sportLabel = SPORT_LABEL;
  readonly formatLabel = FORMAT_LABEL;
  readonly ruleTypes = RULE_TYPES;
  readonly sportOptions: readonly SelectOption[] = SPORTS.map(value => ({ value, label: SPORT_LABEL[value] }));
  readonly bracketOptions: readonly SelectOption[] = [
    { value: 'SINGLE_ELIMINATION', label: FORMAT_LABEL.SINGLE_ELIMINATION },
    { value: 'ROUND_ROBIN', label: FORMAT_LABEL.ROUND_ROBIN }
  ];
  readonly genderOptions: readonly SelectOption[] = [
    { value: 'FEMALE', label: 'Chỉ dành cho Nữ' }, { value: 'MALE', label: 'Chỉ dành cho Nam' }
  ];
  readonly operatorOptions: readonly SelectOption[] = [
    { value: 'GREATER_THAN_OR_EQUAL', label: 'Từ' }, { value: 'LESS_THAN_OR_EQUAL', label: 'Tối đa' }
  ];
  readonly skillOptions: readonly SelectOption[] = [
    { value: 'BEGINNER', label: 'Mới chơi' }, { value: 'INTERMEDIATE', label: 'Trung bình' },
    { value: 'ADVANCED', label: 'Nâng cao' }, { value: 'PRO', label: 'Chuyên nghiệp' }
  ];

  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly venuesLoading = signal(true);
  readonly formats = signal<PlayFormat[]>([]);
  readonly playFormatOptions = computed<SelectOption[]>(() => this.formats().map(item => ({ value: item.code, label: item.label })));
  readonly venueOptions = computed<SelectOption[]>(() => this.venues().map(item => ({ value: item.venueId, label: item.name })));
  readonly saving = signal<'draft' | 'publish' | null>(null);
  readonly errors = signal<Errors>({});
  /** Tang moi lan form doi de computed tinh lai (form dung ngModel, khong phai signal). */
  readonly revision = signal(0);

  form!: TournamentUpsert;
  rulesText = '';
  eligibility: EligibilityRule[] = [];

  get isEdit(): boolean { return !!this.tournament; }

  readonly venue = computed(() => {
    this.revision();
    return this.venues().find(item => item.venueId === this.form?.venueId) ?? null;
  });
  readonly sportCourts = computed(() => (this.venue()?.courts ?? [])
    .filter(court => court.sportType === this.form.sportType && court.active));
  readonly capacityInfo = computed(() => {
    this.revision();
    const form = this.form;
    return capacity(form.format, Number(form.maxParticipants) || 0, form.courtIds.length, form.startDate, form.endDate,
      form.dailyStartTime, form.dailyEndTime, Number(form.matchDurationMinutes) || 0);
  });
  readonly selectedFormat = computed(() => {
    this.revision();
    return this.formats().find(item => item.code === this.form.playFormat) ?? null;
  });

  ngOnInit(): void {
    const source = this.tournament;
    const now = new Date();
    this.form = source ? {
      name: source.name, description: source.description ?? '', sportType: source.sportType, format: source.format,
      maxParticipants: source.maxParticipants, entryFee: source.entryFee ?? 0, prizePool: source.prizePool ?? 0,
      registrationOpenDate: source.registrationOpenDate, registrationCloseDate: source.registrationCloseDate,
      startDate: source.startDate, endDate: source.endDate, rules: source.rules ?? [], eligibilityRules: [],
      venueId: source.venueId ?? '', courtIds: [...(source.courtIds ?? [])],
      dailyStartTime: (source.dailyStartTime ?? '07:00').slice(0, 5), dailyEndTime: (source.dailyEndTime ?? '21:00').slice(0, 5),
      matchDurationMinutes: source.matchDurationMinutes ?? 60, playFormat: source.playFormat
    } : {
      name: '', description: '', sportType: 'BADMINTON', format: 'SINGLE_ELIMINATION', maxParticipants: 16,
      entryFee: 0, prizePool: 0, registrationOpenDate: isoDate(now), registrationCloseDate: isoDate(addDays(now, 7)),
      startDate: isoDate(addDays(now, 9)), endDate: isoDate(addDays(now, 10)), rules: [], eligibilityRules: [],
      venueId: '', courtIds: [], dailyStartTime: '07:00', dailyEndTime: '21:00', matchDurationMinutes: 45, playFormat: ''
    };
    this.rulesText = (source?.rules ?? []).join('\n');
    this.eligibility = this.rules.filter(rule => rule.ruleType !== 'TEAM_SIZE' && rule.ruleType !== 'CLUB_MEMBERSHIP')
      .map(rule => ({ ruleType: rule.ruleType, operator: rule.operator, expectedValue: rule.expectedValue }));

    this.getVenues.execute().subscribe({
      next: venues => {
        this.venues.set(venues.filter(venue => venue.active));
        this.venuesLoading.set(false);
        if (!this.form.venueId && this.venues().length) this.selectVenue(this.venues()[0].venueId);
        this.touch();
      },
      error: () => { this.venuesLoading.set(false); this.notify.error('Không tải được danh sách cơ sở của bạn.'); }
    });
    this.loadFormats(!source);
  }

  touch(): void { this.revision.update(value => value + 1); }

  close(): void { if (!this.saving()) this.closed.emit(); }

  selectSport(sport: TournamentSport): void {
    this.form.sportType = sport;
    this.form.courtIds = [];
    this.loadFormats(true);
    this.touch();
  }

  /** Doi co so: bo chon san cu va lay gio mo cua lam khung gio mac dinh. */
  selectVenue(venueId: string): void {
    this.form.venueId = venueId;
    this.form.courtIds = [];
    const venue = this.venues().find(item => item.venueId === venueId);
    if (venue?.openTime) this.form.dailyStartTime = venue.openTime.slice(0, 5);
    if (venue?.closeTime) this.form.dailyEndTime = venue.closeTime.slice(0, 5);
    this.touch();
  }

  toggleCourt(courtId: string, checked: boolean): void {
    this.form.courtIds = checked ? [...this.form.courtIds, courtId] : this.form.courtIds.filter(id => id !== courtId);
    this.touch();
  }

  addRule(): void {
    this.eligibility = [...this.eligibility, { ruleType: 'AGE', operator: 'GREATER_THAN_OR_EQUAL', expectedValue: '18' }];
  }

  changeRuleType(index: number, type: EligibilityRuleType): void {
    const defaults: Record<string, EligibilityRule> = {
      AGE: { ruleType: 'AGE', operator: 'GREATER_THAN_OR_EQUAL', expectedValue: '18' },
      GENDER: { ruleType: 'GENDER', operator: 'EQUAL', expectedValue: 'FEMALE' },
      SKILL_LEVEL: { ruleType: 'SKILL_LEVEL', operator: 'LESS_THAN_OR_EQUAL', expectedValue: 'INTERMEDIATE' },
      ELO_RATING: { ruleType: 'ELO_RATING', operator: 'LESS_THAN_OR_EQUAL', expectedValue: '1400' }
    };
    this.eligibility = this.eligibility.map((rule, position) => position === index ? { ...defaults[type] } : rule);
  }

  removeRule(index: number): void { this.eligibility = this.eligibility.filter((_, position) => position !== index); }

  submit(publish: boolean): void {
    if (this.saving()) return;
    const errors = this.validate();
    this.errors.set(errors);
    if (Object.keys(errors).length) { this.notify.warning('Vui lòng kiểm tra lại các trường được đánh dấu.'); return; }
    const payload: TournamentUpsert = {
      ...this.form,
      name: this.form.name.trim(),
      description: this.form.description?.trim() || undefined,
      maxParticipants: Number(this.form.maxParticipants),
      entryFee: Number(this.form.entryFee) || 0,
      prizePool: Number(this.form.prizePool) || 0,
      matchDurationMinutes: Number(this.form.matchDurationMinutes),
      rules: this.rulesText.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 20),
      eligibilityRules: this.eligibility.map(rule => ({ ...rule, expectedValue: String(rule.expectedValue).trim() }))
    };
    if (!this.isEdit) payload.publish = publish;
    this.saving.set(publish ? 'publish' : 'draft');
    const request = this.tournament
      ? this.repository.update(this.tournament.tournamentId, payload)
      : this.repository.create(payload);
    request.subscribe({
      next: tournament => {
        this.saving.set(null);
        this.notify.success(this.isEdit ? 'Đã lưu thay đổi.' : publish ? 'Đã công bố giải và giữ sân.' : 'Đã lưu bản nháp.');
        this.saved.emit(tournament);
      },
      error: error => { this.saving.set(null); this.notify.error(error?.error?.message ?? 'Không lưu được giải đấu.'); }
    });
  }

  private loadFormats(pickFirst: boolean): void {
    this.repository.getPlayFormats(this.form.sportType).subscribe({
      next: formats => {
        this.formats.set(formats);
        if (pickFirst || !formats.some(item => item.code === this.form.playFormat)) {
          this.form.playFormat = formats[0]?.code ?? '';
        }
        this.touch();
      },
      error: () => this.notify.error('Không tải được hình thức thi đấu.')
    });
  }

  private validate(): Errors {
    const errors: Errors = {};
    const form = this.form;
    if (!form.name?.trim()) errors.name = 'Nhập tên giải đấu.';
    if (!form.venueId) errors.venue = 'Chọn cơ sở tổ chức.';
    if (!form.courtIds.length) errors.courts = 'Chọn ít nhất một sân ' + SPORT_LABEL[form.sportType].toLowerCase() + '.';
    if (!form.playFormat) errors.format = 'Chọn hình thức thi đấu.';
    if (!form.dailyStartTime || !form.dailyEndTime || form.dailyEndTime <= form.dailyStartTime) {
      errors.window = 'Giờ kết thúc phải sau giờ bắt đầu.';
    }
    const max = Number(form.maxParticipants);
    if (!Number.isInteger(max) || max < 2 || max > 128) errors.size = 'Số suất từ 2 đến 128.';
    if (!form.registrationOpenDate || !form.registrationCloseDate || !form.startDate || !form.endDate) {
      errors.dates = 'Chọn đủ bốn mốc thời gian.';
    } else if (form.registrationCloseDate < form.registrationOpenDate) errors.dates = 'Hạn đóng đăng ký phải sau ngày mở.';
    else if (form.startDate < form.registrationCloseDate) errors.dates = 'Ngày khai mạc phải sau hạn đóng đăng ký.';
    else if (form.endDate < form.startDate) errors.dates = 'Ngày kết thúc phải sau ngày khai mạc.';
    else if (form.startDate < isoDate(new Date())) errors.dates = 'Ngày khai mạc đã qua.';
    if (!errors.courts && !errors.window && !this.capacityInfo().enough) {
      errors.courts = `Không đủ sân: cần ${this.capacityInfo().required} trận, sân đã chọn chỉ đủ ${this.capacityInfo().available}.`;
    }
    return errors;
  }
}
