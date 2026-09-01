import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap, take } from 'rxjs';
import {
  CourtPricingRule,
  CourtPricingRuleUpsert,
  OwnerTimeSlot,
  ScheduleDayOfWeek
} from '@application/dto/owner-schedule/owner-schedule.dto';
import {
  OwnerVenueCourt,
  OwnerVenueOverview
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

interface DayOption { value: ScheduleDayOfWeek; label: string; }
interface SlotGroup { date: string; slots: OwnerTimeSlot[]; }

@Component({
  selector: 'app-owner-schedule',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideIconComponent, PageLoadingComponent],
  templateUrl: './owner-schedule.component.html',
  styleUrl: './owner-schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerScheduleComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly manageSchedule = inject(ManageOwnerScheduleUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

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
  readonly activeTab = signal<'pricing' | 'calendar'>('pricing');
  readonly loadingContext = signal(true);
  readonly loadingData = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly ruleEditorOpen = signal(false);
  readonly editingRule = signal<CourtPricingRule | null>(null);
  readonly savingRule = signal(false);
  readonly deletingRuleId = signal<string | null>(null);
  readonly generating = signal(false);
  readonly mutatingSlotId = signal<string | null>(null);

  readonly selectedVenue = computed(() =>
    this.venues().find(venue => venue.venueId === this.selectedVenueId()) ?? null
  );
  readonly selectedCourt = computed(() =>
    this.courts().find(court => court.venueCourtId === this.selectedCourtId()) ?? null
  );
  readonly slotGroups = computed<SlotGroup[]>(() => {
    const grouped = new Map<string, OwnerTimeSlot[]>();
    for (const slot of this.slots()) {
      grouped.set(slot.date, [...(grouped.get(slot.date) ?? []), slot]);
    }
    return [...grouped.entries()].map(([date, slots]) => ({ date, slots }));
  });

  readonly ruleForm = this.formBuilder.nonNullable.group({
    dayOfWeek: this.formBuilder.nonNullable.control<ScheduleDayOfWeek>('MONDAY', Validators.required),
    startTime: ['06:00', Validators.required],
    endTime: ['07:00', Validators.required],
    basePricePerHour: [100000, [Validators.required, Validators.min(1)]],
    pricePerHour: [100000, [Validators.required, Validators.min(1)]],
    effectiveFrom: [this.today(), Validators.required],
    effectiveTo: [this.addDays(30), Validators.required]
  });
  readonly generationForm = this.formBuilder.nonNullable.group({
    fromDate: [this.today(), Validators.required],
    toDate: [this.addDays(6), Validators.required],
    slotDurationMinutes: [60, [Validators.required, Validators.min(30), Validators.max(240)]]
  });

  constructor() { this.loadContext(); }

  loadContext(): void {
    this.loadingContext.set(true);
    this.loadError.set(null);
    this.getVenues.execute().pipe(
      take(1),
      switchMap(venues => {
        this.venues.set(venues);
        const venueId = venues.some(item => item.venueId === this.selectedVenueId())
          ? this.selectedVenueId() : venues[0]?.venueId ?? '';
        this.selectedVenueId.set(venueId);
        return venueId ? this.manageCourts.list(venueId) : of([] as OwnerVenueCourt[]);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingContext.set(false))
    ).subscribe({
      next: courts => {
        this.courts.set(courts);
        this.selectCourt(courts[0]?.venueCourtId ?? '');
      },
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải cơ sở và sân thi đấu.'))
    });
  }

  selectVenue(venueId: string): void {
    if (this.loadingData() || this.savingRule() || this.generating()) return;
    this.selectedVenueId.set(venueId);
    this.selectedCourtId.set('');
    this.rules.set([]);
    this.slots.set([]);
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
    this.ruleEditorOpen.set(false);
    if (!courtId) {
      this.rules.set([]);
      this.slots.set([]);
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
      slots: this.manageSchedule.listSlots(courtId, range.fromDate, range.toDate)
    }).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingData.set(false))
    ).subscribe({
      next: result => { this.rules.set(result.rules); this.slots.set(result.slots); },
      error: error => {
        this.rules.set([]);
        this.slots.set([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải lịch và bảng giá.'));
      }
    });
  }

  openRuleEditor(rule?: CourtPricingRule): void {
    if (this.savingRule()) return;
    this.editingRule.set(rule ?? null);
    this.ruleForm.reset(rule ? {
      dayOfWeek: rule.dayOfWeek, startTime: this.timeValue(rule.startTime),
      endTime: this.timeValue(rule.endTime), basePricePerHour: rule.basePricePerHour,
      pricePerHour: rule.pricePerHour, effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo
    } : {
      dayOfWeek: 'MONDAY', startTime: this.selectedVenue()?.openTime?.slice(0, 5) ?? '06:00',
      endTime: '07:00', basePricePerHour: 100000, pricePerHour: 100000,
      effectiveFrom: this.today(), effectiveTo: this.addDays(30)
    });
    this.ruleEditorOpen.set(true);
  }

  closeRuleEditor(): void { if (!this.savingRule()) this.ruleEditorOpen.set(false); }

  saveRule(): void {
    if (this.savingRule()) return;
    this.ruleForm.markAllAsTouched();
    const courtId = this.selectedCourtId();
    const value = this.ruleForm.getRawValue();
    if (!courtId || this.ruleForm.invalid) return;
    if (value.startTime >= value.endTime || value.effectiveFrom > value.effectiveTo) {
      this.notify.error('Giờ hoặc khoảng ngày hiệu lực chưa hợp lệ.');
      return;
    }
    const editing = this.editingRule();
    const request: CourtPricingRuleUpsert = value;
    const operation = editing
      ? this.manageSchedule.updateRule(courtId, editing.pricingRuleId, request)
      : this.manageSchedule.createRule(courtId, request);
    this.savingRule.set(true);
    this.ruleForm.disable({ emitEvent: false });
    operation.pipe(
      take(1), takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.savingRule.set(false); this.ruleForm.enable({ emitEvent: false }); })
    ).subscribe({
      next: saved => {
        this.rules.update(items => this.sortRules(
          items.some(item => item.pricingRuleId === saved.pricingRuleId)
            ? items.map(item => item.pricingRuleId === saved.pricingRuleId ? saved : item)
            : [...items, saved]
        ));
        this.ruleEditorOpen.set(false);
        this.notify.success(editing ? 'Đã cập nhật quy tắc giá.' : 'Đã tạo quy tắc giá.');
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
        this.notify.success('Đã xóa quy tắc giá.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể xóa quy tắc giá.'))
    });
  }

  generateSlots(): void {
    if (this.generating()) return;
    this.generationForm.markAllAsTouched();
    const courtId = this.selectedCourtId();
    const request = this.generationForm.getRawValue();
    if (!courtId || this.generationForm.invalid) return;
    if (request.fromDate > request.toDate) {
      this.notify.error('Khoảng ngày sinh lịch chưa hợp lệ.');
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
  formatDate(value: string): string { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date(`${value}T00:00:00`)); }
  timeValue(value: string): string { return value.slice(0, 5); }

  private sortRules(rules: CourtPricingRule[]): CourtPricingRule[] {
    const dayOrder = this.days.map(day => day.value);
    return [...rules].sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek)
      || a.startTime.localeCompare(b.startTime));
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
