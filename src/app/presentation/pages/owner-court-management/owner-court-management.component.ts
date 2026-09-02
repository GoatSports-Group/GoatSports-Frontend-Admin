import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, finalize, interval, switchMap, take } from 'rxjs';
import {
  CourtAvailabilityStatus,
  OwnerVenueCourt,
  OwnerVenueCourtUpsert,
  OwnerVenueOverview,
  SportType
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

interface SportOption {
  value: SportType;
  label: string;
  symbol: string;
  tone: string;
}

type CourtFilter = 'ALL' | 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

@Component({
  selector: 'app-owner-court-management',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideIconComponent, PageLoadingComponent],
  templateUrl: './owner-court-management.component.html',
  styleUrl: './owner-court-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerCourtManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getMyVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sports: readonly SportOption[] = [
    { value: 'FOOTBALL', label: 'Bóng đá', symbol: '⚽', tone: 'green' },
    { value: 'BADMINTON', label: 'Cầu lông', symbol: '🏸', tone: 'blue' },
    { value: 'TENNIS', label: 'Tennis', symbol: '●', tone: 'lime' },
    { value: 'BASKETBALL', label: 'Bóng rổ', symbol: '●', tone: 'orange' },
    { value: 'PICKLEBALL', label: 'Pickleball', symbol: '◉', tone: 'teal' },
    { value: 'VOLLEYBALL', label: 'Bóng chuyền', symbol: '●', tone: 'violet' }
  ];
  readonly surfaceOptions = ['Thảm PVC', 'Cỏ nhân tạo', 'Sàn gỗ', 'Sơn cứng', 'Acrylic', 'Xi măng'];
  readonly filterOptions: ReadonlyArray<{ value: CourtFilter; label: string }> = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'ACTIVE', label: 'Đang hoạt động' },
    { value: 'MAINTENANCE', label: 'Đang bảo trì' },
    { value: 'INACTIVE', label: 'Ngừng hoạt động' }
  ];
  readonly availabilityLabels: Readonly<Record<CourtAvailabilityStatus, string>> = {
    AVAILABLE: 'Đang hoạt động',
    HELD: 'Đang giữ chỗ',
    OCCUPIED: 'Đang sử dụng',
    MAINTENANCE: 'Đang bảo trì',
    INACTIVE: 'Ngừng hoạt động'
  };

  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly selectedVenueId = signal<string | null>(null);
  readonly venue = computed(() => this.venues().find(item => item.venueId === this.selectedVenueId()) ?? null);
  readonly courts = signal<OwnerVenueCourt[]>([]);
  readonly loading = signal(true);
  readonly courtLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly togglingId = signal<string | null>(null);
  readonly editorOpen = signal(false);
  readonly editingCourt = signal<OwnerVenueCourt | null>(null);
  readonly query = signal('');
  readonly statusFilter = signal<CourtFilter>('ALL');
  readonly filterOpen = signal(false);
  readonly actionMenuId = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = 8;

  readonly totalCapacity = computed(() => this.courts().reduce((sum, court) => sum + court.capacity, 0));
  readonly activeCount = computed(() => this.courts().filter(court =>
    court.active && this.courtAvailability(court) !== 'MAINTENANCE'
  ).length);
  readonly maintenanceCount = computed(() => this.courts().filter(court =>
    this.courtAvailability(court) === 'MAINTENANCE'
  ).length);
  readonly inactiveCount = computed(() => this.courts().filter(court => !court.active).length);
  readonly filteredCourts = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('vi');
    const filter = this.statusFilter();
    return this.courts().filter(court => {
      const searchable = [court.name, court.venueCourtId, court.surfaceType, this.sportLabel(court.sportType)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi');
      const statusMatches = filter === 'ALL'
        || (filter === 'ACTIVE' && court.active && this.courtAvailability(court) !== 'MAINTENANCE')
        || (filter === 'MAINTENANCE' && this.courtAvailability(court) === 'MAINTENANCE')
        || (filter === 'INACTIVE' && !court.active);
      return (!query || searchable.includes(query)) && statusMatches;
    });
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredCourts().length / this.pageSize)));
  readonly pagedCourts = computed(() => {
    const currentPage = Math.min(this.page(), this.pageCount());
    return this.filteredCourts().slice((currentPage - 1) * this.pageSize, currentPage * this.pageSize);
  });
  readonly resultStart = computed(() => this.filteredCourts().length ? (Math.min(this.page(), this.pageCount()) - 1) * this.pageSize + 1 : 0);
  readonly resultEnd = computed(() => Math.min(this.resultStart() + this.pageSize - 1, this.filteredCourts().length));

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    sportType: this.formBuilder.nonNullable.control<SportType>('FOOTBALL', Validators.required),
    capacity: [1, [Validators.required, Validators.min(1), Validators.max(100000)]],
    surfaceType: ['', Validators.maxLength(255)],
    active: [true]
  });

  constructor() {
    this.load();
    interval(30_000).pipe(
      switchMap(() => {
        const venueId = this.selectedVenueId();
        return venueId ? this.manageCourts.list(venueId) : EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({ next: courts => this.courts.set(this.sortCourts(courts)) });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.getMyVenues.execute().pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: venues => {
        this.venues.set(venues);
        if (!venues.length) {
          this.selectedVenueId.set(null);
          this.courts.set([]);
          return;
        }
        const venueId = venues.some(item => item.venueId === this.selectedVenueId())
          ? this.selectedVenueId()!
          : venues[0].venueId;
        this.selectVenue(venueId, true);
      },
      error: error => {
        this.venues.set([]);
        this.courts.set([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải danh sách sân thi đấu.'));
      }
    });
  }

  selectVenue(venueId: string, force = false): void {
    if ((!force && venueId === this.selectedVenueId()) || this.saving() || this.courtLoading()) return;
    this.selectedVenueId.set(venueId);
    this.closeEditor();
    this.query.set('');
    this.statusFilter.set('ALL');
    this.page.set(1);
    this.courtLoading.set(true);
    this.loadError.set(null);
    this.manageCourts.list(venueId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.courtLoading.set(false))
    ).subscribe({
      next: courts => this.courts.set(this.sortCourts(courts)),
      error: error => {
        this.courts.set([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải danh sách sân của cơ sở đã chọn.'));
      }
    });
  }

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  setStatusFilter(filter: CourtFilter): void {
    this.statusFilter.set(filter);
    this.filterOpen.set(false);
    this.page.set(1);
  }

  statusFilterLabel(): string {
    return this.filterOptions.find(option => option.value === this.statusFilter())?.label ?? 'Bộ lọc';
  }

  previousPage(): void {
    this.page.update(page => Math.max(1, page - 1));
  }

  nextPage(): void {
    this.page.update(page => Math.min(this.pageCount(), page + 1));
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
    this.actionMenuId.set(null);
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
    if (!this.saving()) {
      this.editorOpen.set(false);
      this.editingCourt.set(null);
    }
  }

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const venueId = this.selectedVenueId();
    if (!venueId || this.form.invalid) return;
    const editing = this.editingCourt();
    const operation = editing
      ? this.manageCourts.update(editing.venueCourtId, this.toRequest())
      : this.manageCourts.create(venueId, this.toRequest());

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    operation.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
      })
    ).subscribe({
      next: saved => {
        this.upsert(saved);
        this.editorOpen.set(false);
        this.editingCourt.set(null);
        this.notify.success(editing ? 'Sân thi đấu đã được cập nhật.' : 'Sân thi đấu đã được tạo.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể lưu sân thi đấu.'))
    });
  }

  toggle(court: OwnerVenueCourt): void {
    if (this.togglingId()) return;
    this.actionMenuId.set(null);
    const active = !court.active;
    if (!active && !window.confirm(`Ngừng hoạt động của “${court.name}”?`)) return;
    this.togglingId.set(court.venueCourtId);
    this.manageCourts.toggle(court.venueCourtId, active).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.togglingId.set(null))
    ).subscribe({
      next: updated => {
        this.upsert(updated);
        this.notify.success(active ? 'Sân đã được bật hoạt động.' : 'Sân đã ngừng hoạt động.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể đổi trạng thái sân.'))
    });
  }

  toggleActionMenu(courtId: string): void {
    this.actionMenuId.update(current => current === courtId ? null : courtId);
  }

  sportOption(value: string): SportOption {
    return this.sports.find(option => option.value === value)
      ?? { value: 'FOOTBALL', label: value, symbol: '●', tone: 'green' };
  }

  sportLabel(value: string): string {
    return this.sportOption(value).label;
  }

  courtAvailability(court: OwnerVenueCourt): CourtAvailabilityStatus {
    return court.active ? (court.availabilityStatus ?? 'AVAILABLE') : 'INACTIVE';
  }

  courtCode(court: OwnerVenueCourt): string {
    const compactId = court.venueCourtId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    return compactId || 'COURT';
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.filterOpen.set(false);
    this.actionMenuId.set(null);
    if (this.editorOpen()) this.closeEditor();
  }

  private toRequest(): OwnerVenueCourtUpsert {
    const value = this.form.getRawValue();
    return { ...value, name: value.name.trim(), surfaceType: value.surfaceType.trim() || undefined };
  }

  private upsert(saved: OwnerVenueCourt): void {
    this.courts.update(courts => {
      const exists = courts.some(court => court.venueCourtId === saved.venueCourtId);
      return this.sortCourts(exists
        ? courts.map(court => court.venueCourtId === saved.venueCourtId ? saved : court)
        : [...courts, saved]);
    });
  }

  private sortCourts(courts: OwnerVenueCourt[]): OwnerVenueCourt[] {
    return [...courts].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
