import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, expand, finalize, forkJoin, of, reduce, switchMap, take } from 'rxjs';
import { OwnerBooking, OwnerBookingFilter } from '@application/dto/owner-booking/owner-booking.dto';
import {
  CourtPricingRule,
  CourtPricingRuleUpsert,
  OwnerTimeSlot,
  OwnerTimeSlotStatus,
  ScheduleDayOfWeek
} from '@application/dto/owner-schedule/owner-schedule.dto';
import {
  OwnerVenueCourt,
  OwnerVenueOverview
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

interface DayOption { value: ScheduleDayOfWeek; label: string; }
interface PricingRuleGroup extends DayOption { rules: CourtPricingRule[]; }
interface SlotGroup { date: string; slots: OwnerTimeSlot[]; }
interface CalendarDay {
  date: string;
  weekday: string;
  dateLabel: string;
  weekend: boolean;
  today: boolean;
  slots: OwnerTimeSlot[];
}
interface CalendarPickerDay {
  date: string;
  day: number;
  inCurrentMonth: boolean;
  inSelectedWeek: boolean;
  today: boolean;
}

type CalendarSlotVisualStatus =
  | 'AVAILABLE'
  | 'AWAITING_CHECK_IN'
  | 'OCCUPIED'
  | 'PAYMENT_DUE'
  | 'UPCOMING'
  | 'COMPLETED'
  | 'MAINTENANCE'
  | 'DISABLED';

@Component({
  selector: 'app-owner-schedule',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideIconComponent, PageLoadingComponent],
  templateUrl: './owner-schedule.component.html',
  styleUrl: './owner-schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerScheduleComponent {
  readonly calendarRowHeight = 72;
  private readonly formBuilder = inject(FormBuilder);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly manageSchedule = inject(ManageOwnerScheduleUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly requestedVenueId = this.route.snapshot.queryParamMap.get('venueId') ?? '';
  private readonly requestedCourtId = this.route.snapshot.queryParamMap.get('venueCourtId') ?? '';
  private readonly requestedTab = this.route.snapshot.queryParamMap.get('tab') ?? '';
  private readonly requestedSlotStatus = this.route.snapshot.queryParamMap.get('status') ?? '';

  readonly days: readonly DayOption[] = [
    { value: 'MONDAY', label: 'Thứ Hai' }, { value: 'TUESDAY', label: 'Thứ Ba' },
    { value: 'WEDNESDAY', label: 'Thứ Tư' }, { value: 'THURSDAY', label: 'Thứ Năm' },
    { value: 'FRIDAY', label: 'Thứ Sáu' }, { value: 'SATURDAY', label: 'Thứ Bảy' },
    { value: 'SUNDAY', label: 'Chủ Nhật' }
  ];
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly courts = signal<OwnerVenueCourt[]>([]);
  readonly selectedVenueId = signal('');
  readonly selectedCourtId = signal('');
  readonly rules = signal<CourtPricingRule[]>([]);
  readonly slots = signal<OwnerTimeSlot[]>([]);
  readonly bookings = signal<OwnerBooking[]>([]);
  readonly slotStatusFilter = signal<'ALL' | OwnerTimeSlotStatus>(
    this.isSlotStatus(this.requestedSlotStatus) ? this.requestedSlotStatus : 'ALL'
  );
  readonly activeTab = signal<'pricing' | 'calendar'>('calendar');
  readonly loadingContext = signal(true);
  readonly loadingData = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly ruleEditorOpen = signal(false);
  readonly editingRule = signal<CourtPricingRule | null>(null);
  readonly selectedRuleDays = signal<ScheduleDayOfWeek[]>(['MONDAY']);
  readonly selectedGenerationRuleIds = signal<string[]>([]);
  readonly collapsedRuleGroups = signal<ScheduleDayOfWeek[]>([]);
  readonly savingRule = signal(false);
  readonly deletingRuleId = signal<string | null>(null);
  readonly generating = signal(false);
  readonly mutatingSlotId = signal<string | null>(null);
  readonly calendarWeekStart = signal(this.startOfWeek(new Date()));
  readonly calendarPickerOpen = signal(false);
  readonly calendarPickerMonth = signal(this.monthStart(this.calendarWeekStart()));

  readonly selectedVenue = computed(() =>
    this.venues().find(venue => venue.venueId === this.selectedVenueId()) ?? null
  );
  readonly selectedCourt = computed(() =>
    this.courts().find(court => court.venueCourtId === this.selectedCourtId()) ?? null
  );
  readonly filteredSlots = computed(() => {
    const status = this.slotStatusFilter();
    return this.slots().filter(slot => status === 'ALL' || slot.status === status);
  });
  readonly slotGroups = computed<SlotGroup[]>(() => {
    const grouped = new Map<string, OwnerTimeSlot[]>();
    for (const slot of this.filteredSlots()) {
      grouped.set(slot.date, [...(grouped.get(slot.date) ?? []), slot]);
    }
    return [...grouped.entries()].map(([date, slots]) => ({ date, slots }));
  });
  readonly calendarWeekEnd = computed(() => this.offsetDate(this.calendarWeekStart(), 6));
  readonly calendarRangeLabel = computed(() =>
    `${this.shortDate(this.calendarWeekStart(), true)} – ${this.shortDate(this.calendarWeekEnd(), true)}`
  );
  readonly calendarPickerMonthLabel = computed(() => {
    const label = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' })
      .format(new Date(`${this.calendarPickerMonth()}T12:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  readonly calendarPickerDays = computed<CalendarPickerDay[]>(() => {
    const monthStart = new Date(`${this.calendarPickerMonth()}T12:00:00`);
    const mondayOffset = (monthStart.getDay() + 6) % 7;
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - mondayOffset);
    const month = monthStart.getMonth();
    const selectedStart = this.calendarWeekStart();
    const selectedEnd = this.calendarWeekEnd();
    const today = this.today();

    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(gridStart);
      value.setDate(gridStart.getDate() + index);
      const date = this.localDate(value);
      return {
        date,
        day: value.getDate(),
        inCurrentMonth: value.getMonth() === month,
        inSelectedWeek: date >= selectedStart && date <= selectedEnd,
        today: date === today
      };
    });
  });
  readonly calendarDays = computed<CalendarDay[]>(() => {
    const today = this.today();
    const slots = this.filteredSlots();
    return Array.from({ length: 7 }, (_, index) => {
      const date = this.offsetDate(this.calendarWeekStart(), index);
      return {
        date,
        weekday: index === 6 ? 'Chủ nhật' : `Thứ ${index + 2}`,
        dateLabel: this.shortDate(date),
        weekend: index >= 5,
        today: date === today,
        slots: slots.filter(slot => slot.date === date)
      };
    });
  });
  readonly calendarStartMinutes = computed(() => this.hourBoundary(this.selectedVenue()?.openTime, 6, 'floor'));
  readonly calendarEndMinutes = computed(() => {
    const start = this.calendarStartMinutes();
    return Math.max(start + 60, this.hourBoundary(this.selectedVenue()?.closeTime, 23, 'ceil'));
  });
  readonly calendarHours = computed(() => {
    const startHour = Math.floor(this.calendarStartMinutes() / 60);
    const endHour = Math.ceil(this.calendarEndMinutes() / 60);
    return Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  });
  readonly calendarGridHeight = computed(() =>
    Math.max(380, ((this.calendarEndMinutes() - this.calendarStartMinutes()) / 60) * this.calendarRowHeight)
  );
  readonly summaryRules = computed(() => this.rules().slice(0, 3));

  readonly ruleForm = this.formBuilder.nonNullable.group({
    dayOfWeek: this.formBuilder.nonNullable.control<ScheduleDayOfWeek>('MONDAY', Validators.required),
    startTime: ['06:00', Validators.required],
    endTime: ['07:00', Validators.required],
    pricePerHour: [100000, [
      Validators.required,
      Validators.min(1),
      (control: AbstractControl) => this.validateVenuePrice(control)
    ]],
    effectiveFrom: [this.today(), Validators.required],
    effectiveTo: [this.addDays(30), Validators.required]
  }, {
    validators: [(control: AbstractControl) => this.validateRuleStartMoment(control)]
  });
  readonly generationForm = this.formBuilder.nonNullable.group({
    fromDate: [this.calendarWeekStart(), Validators.required],
    toDate: [this.calendarWeekEnd(), Validators.required],
    slotDurationMinutes: [60, [Validators.required, Validators.min(30), Validators.max(240)]]
  });
  readonly generationRange = signal({
    fromDate: this.generationForm.controls.fromDate.value,
    toDate: this.generationForm.controls.toDate.value
  });
  readonly applicableRules = computed(() => {
    const { fromDate, toDate } = this.generationRange();
    if (!fromDate || !toDate || fromDate > toDate) return [];
    return this.sortRules(this.rules().filter(rule => this.ruleAppliesWithinRange(rule, fromDate, toDate)));
  });
  readonly applicableRuleGroups = computed<PricingRuleGroup[]>(() => {
    const rules = this.applicableRules();
    return this.days
      .map(day => ({ ...day, rules: rules.filter(rule => rule.dayOfWeek === day.value) }))
      .filter(group => group.rules.length > 0);
  });

  constructor() {
    if (this.requestedTab === 'pricing') this.activeTab.set('pricing');
    this.generationForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const { fromDate, toDate } = this.generationForm.getRawValue();
      this.generationRange.set({ fromDate, toDate });
      this.pruneGenerationRuleSelection();
    });
    this.loadContext();
  }

  loadContext(): void {
    this.loadingContext.set(true);
    this.loadError.set(null);
    this.getVenues.execute().pipe(
      take(1),
      switchMap(venues => {
        this.venues.set(venues);
        const preferredVenueId = this.requestedVenueId || this.selectedVenueId();
        const venueId = venues.some(item => item.venueId === preferredVenueId)
          ? preferredVenueId : venues[0]?.venueId ?? '';
        this.selectedVenueId.set(venueId);
        return venueId ? this.manageCourts.list(venueId) : of([] as OwnerVenueCourt[]);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingContext.set(false))
    ).subscribe({
      next: courts => {
        this.courts.set(courts);
        const courtId = courts.some(court => court.venueCourtId === this.requestedCourtId)
          ? this.requestedCourtId
          : courts[0]?.venueCourtId ?? '';
        this.selectCourt(courtId);
      },
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải cơ sở và sân thi đấu.'))
    });
  }

  selectVenue(venueId: string): void {
    if (this.loadingData() || this.savingRule() || this.generating()) return;
    this.selectedVenueId.set(venueId);
    this.selectedCourtId.set('');
    this.selectedGenerationRuleIds.set([]);
    this.rules.set([]);
    this.slots.set([]);
    this.bookings.set([]);
    this.loadingContext.set(true);
    this.manageCourts.list(venueId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingContext.set(false))
    ).subscribe({
      next: courts => {
        this.courts.set(courts);
        this.selectCourt(courts[0]?.venueCourtId ?? '');
      },
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải sân thi đấu.'))
    });
  }

  selectCourt(courtId: string): void {
    if (this.loadingData() || this.savingRule() || this.generating()) return;
    this.selectedCourtId.set(courtId);
    this.selectedGenerationRuleIds.set([]);
    this.ruleEditorOpen.set(false);
    if (!courtId) {
      this.rules.set([]);
      this.slots.set([]);
      this.bookings.set([]);
      return;
    }
    this.loadSchedule();
  }

  loadSchedule(): void {
    const courtId = this.selectedCourtId();
    if (!courtId) return;
    const range = this.generationForm.getRawValue();
    this.loadingData.set(true);
    this.loadError.set(null);
    forkJoin({
      rules: this.manageSchedule.listRules(courtId),
      slots: this.manageSchedule.listSlots(courtId, range.fromDate, range.toDate),
      bookings: this.loadAllBookings({
        venueId: this.selectedVenueId(),
        venueCourtId: courtId,
        fromDate: range.fromDate,
        toDate: range.toDate
      }).pipe(catchError(() => of([] as OwnerBooking[])))
    }).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingData.set(false))
    ).subscribe({
      next: result => {
        this.rules.set(result.rules);
        this.slots.set(result.slots);
        this.bookings.set(result.bookings);
      },
      error: error => {
        this.rules.set([]);
        this.slots.set([]);
        this.bookings.set([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải lịch và bảng giá.'));
      }
    });
  }

  openRuleEditor(rule?: CourtPricingRule): void {
    if (this.savingRule()) return;
    this.editingRule.set(rule ?? null);
    this.selectedRuleDays.set([rule?.dayOfWeek ?? 'MONDAY']);
    this.ruleForm.reset(rule ? {
      dayOfWeek: rule.dayOfWeek, startTime: this.timeValue(rule.startTime),
      endTime: this.timeValue(rule.endTime), pricePerHour: rule.pricePerHour,
      effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo
    } : {
      dayOfWeek: 'MONDAY', startTime: this.selectedVenue()?.openTime?.slice(0, 5) ?? '06:00',
      endTime: '07:00', pricePerHour: this.defaultVenuePrice(),
      effectiveFrom: this.today(), effectiveTo: this.addDays(30)
    });
    this.ruleForm.updateValueAndValidity({ emitEvent: false });
    this.ruleEditorOpen.set(true);
  }

  closeRuleEditor(): void { if (!this.savingRule()) this.ruleEditorOpen.set(false); }

  @HostListener('document:keydown.escape')
  closeRuleEditorWithEscape(): void {
    this.calendarPickerOpen.set(false);
    if (this.ruleEditorOpen()) this.closeRuleEditor();
  }

  @HostListener('document:click')
  closeCalendarPickerOnOutsideClick(): void {
    this.calendarPickerOpen.set(false);
  }

  isRuleDaySelected(day: ScheduleDayOfWeek): boolean {
    return this.selectedRuleDays().includes(day);
  }

  toggleRuleDay(day: ScheduleDayOfWeek): void {
    if (this.savingRule()) return;
    const selected = this.selectedRuleDays();
    const next = selected.includes(day)
      ? selected.length > 1 ? selected.filter(item => item !== day) : selected
      : this.days.map(item => item.value).filter(item => [...selected, day].includes(item));
    this.selectedRuleDays.set(next);
    this.ruleForm.controls.dayOfWeek.setValue(next[0]);
    this.ruleForm.updateValueAndValidity({ emitEvent: false });
  }

  saveRule(): void {
    if (this.savingRule()) return;
    this.ruleForm.controls.pricePerHour.updateValueAndValidity({ emitEvent: false });
    this.ruleForm.markAllAsTouched();
    const courtId = this.selectedCourtId();
    const value = this.ruleForm.getRawValue();
    if (!courtId || this.ruleForm.invalid) return;
    if (value.startTime >= value.endTime || value.effectiveFrom > value.effectiveTo) {
      this.notify.error('Giờ hoặc khoảng ngày hiệu lực chưa hợp lệ.');
      return;
    }
    const editing = this.editingRule();
    const selectedDays = this.selectedRuleDays();
    const primaryDay = editing && selectedDays.includes(editing.dayOfWeek)
      ? editing.dayOfWeek : selectedDays[0];
    const orderedDays = [primaryDay, ...selectedDays.filter(day => day !== primaryDay)];
    const operations: Observable<CourtPricingRule>[] = orderedDays.map((day, index) => {
      const request: CourtPricingRuleUpsert = {
        ...value,
        dayOfWeek: day,
        basePricePerHour: value.pricePerHour
      };
      return editing && index === 0
        ? this.manageSchedule.updateRule(courtId, editing.pricingRuleId, request)
        : this.manageSchedule.createRule(courtId, request);
    });
    this.savingRule.set(true);
    this.ruleForm.disable({ emitEvent: false });
    forkJoin(operations).pipe(
      take(1), takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.savingRule.set(false); this.ruleForm.enable({ emitEvent: false }); })
    ).subscribe({
      next: savedRules => {
        this.rules.update(items => this.sortRules([
          ...items.filter(item => item.pricingRuleId !== editing?.pricingRuleId),
          ...savedRules
        ]));
        this.ruleEditorOpen.set(false);
        const dayCount = savedRules.length;
        this.notify.success(editing
          ? `Đã cập nhật quy tắc giá cho ${dayCount} ngày.`
          : `Đã tạo quy tắc giá cho ${dayCount} ngày.`);
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể lưu quy tắc giá.'))
    });
  }

  deleteRule(rule: CourtPricingRule): void {
    const courtId = this.selectedCourtId();
    if (!courtId || this.deletingRuleId() || !window.confirm('Xóa quy tắc giá này? Slot đã sinh vẫn giữ giá snapshot.')) return;
    this.deletingRuleId.set(rule.pricingRuleId);
    this.manageSchedule.deleteRule(courtId, rule.pricingRuleId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.deletingRuleId.set(null))
    ).subscribe({
      next: () => {
        this.rules.update(items => items.filter(item => item.pricingRuleId !== rule.pricingRuleId));
        this.selectedGenerationRuleIds.update(ids => ids.filter(id => id !== rule.pricingRuleId));
        this.notify.success('Đã xóa quy tắc giá.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể xóa quy tắc giá.'))
    });
  }

  generateSlots(): void {
    if (this.generating()) return;
    this.generationForm.markAllAsTouched();
    const courtId = this.selectedCourtId();
    const request = {
      ...this.generationForm.getRawValue(),
      pricingRuleIds: this.selectedGenerationRuleIds()
    };
    if (!courtId || this.generationForm.invalid) return;
    if (request.fromDate > request.toDate) {
      this.notify.error('Khoảng ngày sinh lịch chưa hợp lệ.');
      return;
    }
    if (!request.pricingRuleIds.length) {
      this.notify.error('Hãy chọn ít nhất một quy tắc giá để sinh lịch.');
      return;
    }
    this.generating.set(true);
    this.generationForm.disable({ emitEvent: false });
    this.manageSchedule.generateSlots(courtId, request).pipe(
      take(1), takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.generating.set(false); this.generationForm.enable({ emitEvent: false }); })
    ).subscribe({
      next: slots => {
        this.slots.set(slots);
        this.notify.success('Lịch khả dụng đã được đồng bộ từ bảng giá.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể sinh lịch.'))
    });
  }

  toggleMaintenance(slot: OwnerTimeSlot): void {
    if (this.mutatingSlotId() || slot.status === 'LOCKED' || slot.status === 'BOOKED') return;
    const nextStatus = slot.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    if (nextStatus === 'MAINTENANCE' && !window.confirm('Đánh dấu slot này là bảo trì?')) return;
    this.mutatingSlotId.set(slot.timeSlotId);
    this.manageSchedule.setSlotStatus(slot.timeSlotId, nextStatus).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.mutatingSlotId.set(null))
    ).subscribe({
      next: updated => {
        this.slots.update(items => items.map(item => item.timeSlotId === updated.timeSlotId ? updated : item));
        this.notify.success(nextStatus === 'MAINTENANCE' ? 'Đã chặn slot để bảo trì.' : 'Slot đã khả dụng trở lại.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể đổi trạng thái slot.'))
    });
  }

  deleteSlot(slot: OwnerTimeSlot): void {
    if (this.mutatingSlotId() || !window.confirm('Xóa slot chưa được đặt này?')) return;
    this.mutatingSlotId.set(slot.timeSlotId);
    this.manageSchedule.deleteSlot(slot.timeSlotId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.mutatingSlotId.set(null))
    ).subscribe({
      next: () => {
        this.slots.update(items => items.filter(item => item.timeSlotId !== slot.timeSlotId));
        this.notify.success('Đã xóa slot.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể xóa slot.'))
    });
  }

  dayLabel(day: ScheduleDayOfWeek): string { return this.days.find(item => item.value === day)?.label ?? day; }
  formatMoney(value: number): string { return new Intl.NumberFormat('vi-VN').format(value) + ' ₫'; }
  compactMoney(value: number): string { return new Intl.NumberFormat('vi-VN').format(value) + 'đ'; }
  formatDate(value: string): string { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date(`${value}T00:00:00`)); }
  timeValue(value: string): string { return value.slice(0, 5); }

  venueMinPrice(): number | null { return this.selectedVenue()?.minPrice ?? null; }
  venueMaxPrice(): number | null { return this.selectedVenue()?.maxPrice ?? null; }
  ruleEffectiveFromMin(): string {
    const existingStart = this.editingRule()?.effectiveFrom;
    const today = this.today();
    return existingStart && existingStart < today ? existingStart : today;
  }

  slotTop(slot: OwnerTimeSlot): number {
    const offset = Math.max(0, this.timeToMinutes(slot.startTime) - this.calendarStartMinutes());
    return (offset / 60) * this.calendarRowHeight;
  }

  isGenerationRuleSelected(ruleId: string): boolean {
    return this.selectedGenerationRuleIds().includes(ruleId);
  }

  toggleGenerationRule(ruleId: string, checked: boolean): void {
    this.selectedGenerationRuleIds.update(ids => checked
      ? ids.includes(ruleId) ? ids : [...ids, ruleId]
      : ids.filter(id => id !== ruleId));
  }

  isRuleGroupSelected(group: PricingRuleGroup): boolean {
    return group.rules.every(rule => this.isGenerationRuleSelected(rule.pricingRuleId));
  }

  isRuleGroupPartiallySelected(group: PricingRuleGroup): boolean {
    const selectedCount = group.rules.filter(rule => this.isGenerationRuleSelected(rule.pricingRuleId)).length;
    return selectedCount > 0 && selectedCount < group.rules.length;
  }

  toggleRuleGroup(group: PricingRuleGroup, checked: boolean): void {
    this.setRulesSelected(group.rules, checked);
  }

  isRuleGroupCollapsed(day: ScheduleDayOfWeek): boolean {
    return this.collapsedRuleGroups().includes(day);
  }

  toggleRuleGroupCollapsed(day: ScheduleDayOfWeek): void {
    this.collapsedRuleGroups.update(days => days.includes(day)
      ? days.filter(item => item !== day)
      : [...days, day]);
  }

  allApplicableRulesSelected(): boolean {
    const rules = this.applicableRules();
    return rules.length > 0 && rules.every(rule => this.isGenerationRuleSelected(rule.pricingRuleId));
  }

  someApplicableRulesSelected(): boolean {
    const rules = this.applicableRules();
    const selectedCount = rules.filter(rule => this.isGenerationRuleSelected(rule.pricingRuleId)).length;
    return selectedCount > 0 && selectedCount < rules.length;
  }

  toggleAllApplicableRules(checked: boolean): void {
    this.setRulesSelected(this.applicableRules(), checked);
  }

  slotHeight(slot: OwnerTimeSlot): number {
    const duration = Math.max(30, this.timeToMinutes(slot.endTime) - this.timeToMinutes(slot.startTime));
    return Math.max(34, (duration / 60) * this.calendarRowHeight - 4);
  }

  slotVisualStatus(slot: OwnerTimeSlot): CalendarSlotVisualStatus {
    const court = this.selectedCourt();
    if (slot.status === 'MAINTENANCE') return 'MAINTENANCE';

    const booking = this.bookingForSlot(slot);
    if (booking?.status === 'COMPLETED') {
      return this.isBookingFullyPaid(booking) ? 'COMPLETED' : 'PAYMENT_DUE';
    }
    if (booking?.status === 'CHECKED_IN') {
      if (!this.isBookingFullyPaid(booking)) return 'PAYMENT_DUE';
      return this.isSlotEnded(slot) ? 'COMPLETED' : 'OCCUPIED';
    }
    if (booking && ['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
      return this.isSlotFuture(slot) ? 'UPCOMING' : 'AWAITING_CHECK_IN';
    }

    if (court?.active === false || court?.availabilityStatus === 'INACTIVE') return 'DISABLED';
    return 'AVAILABLE';
  }

  slotStatusLabel(slot: OwnerTimeSlot): string {
    const labels: Record<CalendarSlotVisualStatus, string> = {
      AVAILABLE: 'Trống',
      AWAITING_CHECK_IN: 'Chưa check-in',
      OCCUPIED: 'Đang sử dụng',
      PAYMENT_DUE: 'Còn công nợ',
      UPCOMING: 'Sắp có lịch',
      COMPLETED: 'Hoàn thành',
      MAINTENANCE: 'Bảo trì',
      DISABLED: 'Tạm ngưng'
    };
    return labels[this.slotVisualStatus(slot)];
  }

  rulePeriodLabel(rule: CourtPricingRule): string {
    if (rule.dayOfWeek === 'SATURDAY' || rule.dayOfWeek === 'SUNDAY') return 'Cuối tuần & Lễ';
    return this.timeToMinutes(rule.startTime) >= 17 * 60 ? 'Giờ cao điểm' : 'Giờ thường';
  }

  ruleSummaryIcon(rule: CourtPricingRule): string {
    if (rule.dayOfWeek === 'SATURDAY' || rule.dayOfWeek === 'SUNDAY') return 'calendar';
    return this.timeToMinutes(rule.startTime) >= 17 * 60 ? 'clock' : 'sun';
  }

  previousWeek(): void { this.moveWeek(-7); }
  nextWeek(): void { this.moveWeek(7); }
  goToCurrentWeek(): void { this.setCalendarWeek(this.startOfWeek(new Date())); }

  openCalendarDatePicker(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.loadingData() || this.generating()) return;
    const opening = !this.calendarPickerOpen();
    if (opening) this.calendarPickerMonth.set(this.monthStart(this.calendarWeekStart()));
    this.calendarPickerOpen.set(opening);
  }

  moveCalendarPickerMonth(offset: number, event: Event): void {
    event.stopPropagation();
    const current = new Date(`${this.calendarPickerMonth()}T12:00:00`);
    current.setMonth(current.getMonth() + offset, 1);
    this.calendarPickerMonth.set(this.localDate(current));
  }

  selectCalendarPickerDate(date: string, event: Event): void {
    event.stopPropagation();
    this.calendarPickerOpen.set(false);
    this.setCalendarWeek(this.startOfWeek(new Date(`${date}T12:00:00`)));
  }

  selectCurrentCalendarWeek(event: Event): void {
    this.selectCalendarPickerDate(this.today(), event);
  }

  selectSlotStatus(value: string): void {
    this.slotStatusFilter.set(this.isSlotStatus(value) ? value : 'ALL');
  }

  private sortRules(rules: CourtPricingRule[]): CourtPricingRule[] {
    const dayOrder = this.days.map(day => day.value);
    return [...rules].sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek)
      || a.startTime.localeCompare(b.startTime));
  }

  private setRulesSelected(rules: CourtPricingRule[], checked: boolean): void {
    const ruleIds = new Set(rules.map(rule => rule.pricingRuleId));
    this.selectedGenerationRuleIds.update(ids => checked
      ? [...new Set([...ids, ...ruleIds])]
      : ids.filter(id => !ruleIds.has(id)));
  }

  private pruneGenerationRuleSelection(): void {
    const applicableIds = new Set(this.applicableRules().map(rule => rule.pricingRuleId));
    this.selectedGenerationRuleIds.update(ids => ids.filter(id => applicableIds.has(id)));
  }

  private ruleAppliesWithinRange(rule: CourtPricingRule, fromDate: string, toDate: string): boolean {
    const overlapStart = rule.effectiveFrom > fromDate ? rule.effectiveFrom : fromDate;
    const overlapEnd = rule.effectiveTo < toDate ? rule.effectiveTo : toDate;
    if (overlapStart > overlapEnd) return false;

    const firstDate = new Date(`${overlapStart}T12:00:00`);
    const weekdayIndex: Record<ScheduleDayOfWeek, number> = {
      SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
      THURSDAY: 4, FRIDAY: 5, SATURDAY: 6
    };
    const daysUntilRule = (weekdayIndex[rule.dayOfWeek] - firstDate.getDay() + 7) % 7;
    firstDate.setDate(firstDate.getDate() + daysUntilRule);
    return this.localDate(firstDate) <= overlapEnd;
  }

  private isSlotStatus(value: string): value is OwnerTimeSlotStatus {
    return ['AVAILABLE', 'LOCKED', 'BOOKED', 'MAINTENANCE'].includes(value);
  }

  private moveWeek(days: number): void {
    this.setCalendarWeek(this.offsetDate(this.calendarWeekStart(), days));
  }

  private setCalendarWeek(start: string): void {
    if (this.loadingData() || this.generating()) return;
    this.calendarWeekStart.set(start);
    this.generationForm.patchValue({ fromDate: start, toDate: this.offsetDate(start, 6) });
    this.loadSchedule();
  }

  private loadAllBookings(filter: Omit<OwnerBookingFilter, 'page' | 'size'>): Observable<OwnerBooking[]> {
    const pageSize = 20;
    return this.manageBookings.list({ ...filter, page: 0, size: pageSize }).pipe(
      expand(page => page.page + 1 < page.pages
        ? this.manageBookings.list({ ...filter, page: page.page + 1, size: pageSize })
        : EMPTY),
      reduce((items, page) => [...items, ...page.items], [] as OwnerBooking[])
    );
  }

  private bookingForSlot(slot: OwnerTimeSlot): OwnerBooking | null {
    return this.bookings().find(booking =>
      booking.venueCourtId === slot.venueCourtId
      && booking.playDate === slot.date
      && this.timeValue(booking.startTime) === this.timeValue(slot.startTime)
      && this.timeValue(booking.endTime) === this.timeValue(slot.endTime)
      && !['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status)
    ) ?? null;
  }

  private isSlotEnded(slot: OwnerTimeSlot): boolean {
    return new Date(`${slot.date}T${this.timeValue(slot.endTime)}:00`) <= new Date();
  }

  private isSlotFuture(slot: OwnerTimeSlot): boolean {
    return new Date(`${slot.date}T${this.timeValue(slot.startTime)}:00`) > new Date();
  }

  private isBookingFullyPaid(booking: OwnerBooking): boolean {
    if (booking.remainingAmount <= 0 || !!booking.remainingPaymentId) return true;
    const paidRemaining = booking.payments
      .filter(payment => payment.purpose === 'BOOKING_REMAINING' && payment.status === 'SUCCEEDED')
      .reduce((total, payment) => total + payment.amount, 0);
    return paidRemaining + 0.01 >= booking.remainingAmount;
  }

  private defaultVenuePrice(): number {
    const minPrice = this.venueMinPrice();
    return minPrice !== null && minPrice > 0 ? minPrice : 100000;
  }

  private validateVenuePrice(control: AbstractControl): ValidationErrors | null {
    const price = Number(control.value);
    const minPrice = this.venueMinPrice();
    const maxPrice = this.venueMaxPrice();
    if (minPrice === null || maxPrice === null || minPrice > maxPrice) {
      return { venuePriceRangeUnavailable: true };
    }
    return price >= minPrice && price <= maxPrice
      ? null
      : { venuePriceRange: { min: minPrice, max: maxPrice } };
  }

  private validateRuleStartMoment(control: AbstractControl): ValidationErrors | null {
    const value = control.value as {
      dayOfWeek?: ScheduleDayOfWeek;
      startTime?: string;
      effectiveFrom?: string;
    } | null;
    const effectiveFrom = value?.effectiveFrom;
    const startTime = value?.startTime;
    if (!effectiveFrom || !startTime) return null;

    const selectedDays = this.selectedRuleDays();
    const editing = this.editingRule();
    const unchangedHistoricalStart = !!editing
      && selectedDays.length === 1
      && selectedDays[0] === editing.dayOfWeek
      && effectiveFrom === editing.effectiveFrom
      && this.timeValue(startTime) === this.timeValue(editing.startTime);
    if (unchangedHistoricalStart) return null;

    const today = this.today();
    if (effectiveFrom < today) return { pastEffectiveStart: true };
    if (effectiveFrom > today) return null;

    const currentDay = this.days[(new Date().getDay() + 6) % 7]?.value;
    const currentTime = new Date().toTimeString().slice(0, 5);
    return currentDay && selectedDays.includes(currentDay) && this.timeValue(startTime) < currentTime
      ? { pastEffectiveStart: true }
      : null;
  }

  private startOfWeek(date: Date): string {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = normalized.getDay();
    normalized.setDate(normalized.getDate() - (day === 0 ? 6 : day - 1));
    return this.localDate(normalized);
  }

  private monthStart(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return this.localDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  private offsetDate(value: string, days: number): string {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return this.localDate(date);
  }

  private shortDate(value: string, includeYear = false): string {
    const date = new Date(`${value}T12:00:00`);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return includeYear ? `${day}/${month}/${date.getFullYear()}` : `${day}/${month}`;
  }

  private hourBoundary(value: string | undefined, fallbackHour: number, mode: 'floor' | 'ceil'): number {
    if (!value) return fallbackHour * 60;
    const minutes = this.timeToMinutes(value);
    return (mode === 'floor' ? Math.floor(minutes / 60) : Math.ceil(minutes / 60)) * 60;
  }

  private timeToMinutes(value: string): number {
    const [hour = 0, minute = 0] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private today(): string { return this.localDate(new Date()); }
  private addDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return this.localDate(date);
  }
  private localDate(date: Date): string {
    const year = date.getFullYear();
    return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
