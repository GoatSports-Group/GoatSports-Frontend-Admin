import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, of, switchMap, take } from 'rxjs';
import {
  OwnerVenueCourt,
  OwnerVenueCourtUpsert,
  OwnerVenueOverview,
  SportType
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venue.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

interface SportOption { value: SportType; label: string; }

@Component({
  selector: 'app-owner-court-management',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideIconComponent],
  templateUrl: './owner-court-management.component.html',
  styleUrl: './owner-court-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerCourtManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getMyVenue = inject(GetMyOwnerVenueUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sports: readonly SportOption[] = [
    { value: 'FOOTBALL', label: 'Bóng đá' }, { value: 'BADMINTON', label: 'Cầu lông' },
    { value: 'TENNIS', label: 'Quần vợt' }, { value: 'BASKETBALL', label: 'Bóng rổ' },
    { value: 'PICKLEBALL', label: 'Pickleball' }, { value: 'VOLLEYBALL', label: 'Bóng chuyền' }
  ];
  readonly venue = signal<OwnerVenueOverview | null>(null);
  readonly courts = signal<OwnerVenueCourt[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly togglingId = signal<string | null>(null);
  readonly editorOpen = signal(false);
  readonly editingCourt = signal<OwnerVenueCourt | null>(null);
  readonly activeCount = computed(() => this.courts().filter(court => court.active).length);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    sportType: this.formBuilder.nonNullable.control<SportType>('FOOTBALL', Validators.required),
    capacity: [1, [Validators.required, Validators.min(1), Validators.max(100000)]],
    surfaceType: ['', Validators.maxLength(255)],
    active: [true]
  });

  constructor() { this.load(); }

  load(): void {
    if (this.loading() && this.venue()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.getMyVenue.execute().pipe(
      take(1),
      switchMap(venue => {
        this.venue.set(venue);
        return venue ? this.manageCourts.list(venue.venueId) : of([] as OwnerVenueCourt[]);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: courts => this.courts.set([...courts].sort((a, b) => a.name.localeCompare(b.name, 'vi'))),
      error: error => {
        this.courts.set([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải danh sách sân thi đấu.'));
      }
    });
  }

  openCreate(): void {
    if (this.saving()) return;
    this.editingCourt.set(null);
    this.form.reset({ name: '', sportType: 'FOOTBALL', capacity: 1, surfaceType: '', active: true });
    this.form.markAsPristine();
    this.editorOpen.set(true);
  }

  openEdit(court: OwnerVenueCourt): void {
    if (this.saving()) return;
    this.editingCourt.set(court);
    this.form.reset({
      name: court.name,
      sportType: court.sportType as SportType,
      capacity: court.capacity,
      surfaceType: court.surfaceType ?? '',
      active: court.active
    });
    this.form.markAsPristine();
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    if (!this.saving()) this.editorOpen.set(false);
  }

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const venue = this.venue();
    if (!venue || this.form.invalid) return;
    const editing = this.editingCourt();
    const request = this.toRequest();
    const operation = editing
      ? this.manageCourts.update(editing.venueCourtId, request)
      : this.manageCourts.create(venue.venueId, request);

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    operation.pipe(
      take(1), takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.saving.set(false); this.form.enable({ emitEvent: false }); })
    ).subscribe({
      next: saved => {
        this.upsert(saved);
        this.editorOpen.set(false);
        this.notify.success(editing ? 'Sân thi đấu đã được cập nhật.' : 'Sân thi đấu đã được tạo.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể lưu sân thi đấu.'))
    });
  }

  toggle(court: OwnerVenueCourt): void {
    if (this.togglingId()) return;
    const active = !court.active;
    if (!active && !window.confirm(`Tạm ngừng hoạt động của “${court.name}”?`)) return;
    this.togglingId.set(court.venueCourtId);
    this.manageCourts.toggle(court.venueCourtId, active).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.togglingId.set(null))
    ).subscribe({
      next: updated => {
        this.upsert(updated);
        this.notify.success(active ? 'Sân đã được bật hoạt động.' : 'Sân đã được tạm ngừng.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể đổi trạng thái sân.'))
    });
  }

  sportLabel(value: string): string {
    return this.sports.find(option => option.value === value)?.label ?? value;
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  private toRequest(): OwnerVenueCourtUpsert {
    const value = this.form.getRawValue();
    return { ...value, name: value.name.trim(), surfaceType: value.surfaceType.trim() || undefined };
  }

  private upsert(saved: OwnerVenueCourt): void {
    this.courts.update(courts => {
      const exists = courts.some(court => court.venueCourtId === saved.venueCourtId);
      const next = exists
        ? courts.map(court => court.venueCourtId === saved.venueCourtId ? saved : court)
        : [...courts, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    });
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
