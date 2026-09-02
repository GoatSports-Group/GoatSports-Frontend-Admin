import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, expand, finalize, interval, reduce, take } from 'rxjs';
import { OwnerBooking, OwnerBookingFilter } from '@application/dto/owner-booking/owner-booking.dto';
import {
  CourtAvailabilityStatus,
  OwnerVenueCourt,
  OwnerVenueCourtUpsert,
  OwnerVenueOverview,
  SportType
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { CourtFloorMarkingComponent } from './court-floor-marking.component';
import {
  FACILITY_CANVAS_HEIGHT,
  FACILITY_CANVAS_WIDTH,
  FACILITY_GRID_SIZE,
  FacilityLayoutItem,
  FacilityObjectType,
  FacilityZone,
  LayoutLibraryItem,
  VenueFacilityLayout,
  cloneFacilityLayout,
  createAutomaticFacilityLayout
} from './facility-layout.models';
import { FacilityLayoutStore } from './facility-layout.store';

interface SportOption {
  value: SportType;
  label: string;
}

interface CourtTypeSummary {
  key: string;
  sportType: string;
  surfaceType: string;
  courts: number;
  capacity: number;
  active: number;
}

type WorkspaceView = 'MAP' | 'LIST' | 'PRICING';
type PanelMode = 'NONE' | 'DETAIL' | 'FORM';
type OperationalStatus = 'AVAILABLE' | 'OCCUPIED' | 'UPCOMING' | 'MAINTENANCE' | 'DISABLED';
type OperationalFilter = 'ALL' | OperationalStatus;

interface PointerOperationBase {
  itemId: string;
  mode: 'MOVE' | 'RESIZE';
  startClientX: number;
  startClientY: number;
  canvasUnitsPerPixelX: number;
  canvasUnitsPerPixelY: number;
}

type PointerOperation = PointerOperationBase & (
  | { target: 'ITEM'; original: FacilityLayoutItem }
  | { target: 'ZONE'; original: FacilityZone }
);

@Component({
  selector: 'app-owner-court-management',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideIconComponent,
    PageLoadingComponent,
    CourtFloorMarkingComponent
  ],
  templateUrl: './owner-court-management.component.html',
  styleUrl: './owner-court-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerCourtManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getMyVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
  private readonly layoutStore = inject(FacilityLayoutStore);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('facilityCanvas') private facilityCanvas?: ElementRef<HTMLElement>;
  @ViewChild('bookingDateInput') private bookingDateInput?: ElementRef<HTMLInputElement>;

  readonly baseCanvasWidth = FACILITY_CANVAS_WIDTH;
  readonly baseCanvasHeight = FACILITY_CANVAS_HEIGHT;
  readonly sports: readonly SportOption[] = [
    { value: 'FOOTBALL', label: 'Bóng đá' },
    { value: 'BADMINTON', label: 'Cầu lông' },
    { value: 'TENNIS', label: 'Tennis' },
    { value: 'BASKETBALL', label: 'Bóng rổ' },
    { value: 'PICKLEBALL', label: 'Pickleball' },
    { value: 'VOLLEYBALL', label: 'Bóng chuyền' }
  ];
  readonly surfaceOptions = ['Thảm PVC', 'Cỏ nhân tạo', 'Sàn gỗ', 'Sơn cứng', 'Acrylic', 'Xi măng'];
  readonly filterOptions: ReadonlyArray<{ value: OperationalFilter; label: string }> = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'AVAILABLE', label: 'Trống' },
    { value: 'OCCUPIED', label: 'Đang sử dụng' },
    { value: 'UPCOMING', label: 'Sắp có lịch' },
    { value: 'MAINTENANCE', label: 'Bảo trì' },
    { value: 'DISABLED', label: 'Tạm ngưng' }
  ];
  readonly legend: ReadonlyArray<{ value: OperationalStatus; label: string }> = [
    { value: 'AVAILABLE', label: 'Trống' },
    { value: 'OCCUPIED', label: 'Đang sử dụng' },
    { value: 'UPCOMING', label: 'Sắp có lịch' },
    { value: 'MAINTENANCE', label: 'Bảo trì' },
    { value: 'DISABLED', label: 'Tạm ngưng' }
  ];
  readonly layoutLibrary: readonly LayoutLibraryItem[] = [
    { type: 'RECEPTION', label: 'Lễ tân', icon: 'store' },
    { type: 'ENTRANCE', label: 'Cổng vào', icon: 'arrow-right' },
    { type: 'PARKING', label: 'Bãi xe', icon: 'land-plot' },
    { type: 'LOCKER', label: 'Tủ đồ', icon: 'folder-open' },
    { type: 'WC', label: 'WC', icon: 'users' },
    { type: 'WAITING', label: 'Khu chờ', icon: 'clock' },
    { type: 'CAFE', label: 'Cafe', icon: 'sun' },
    { type: 'STORAGE', label: 'Kho', icon: 'inbox' },
    { type: 'CUSTOM', label: 'Tiện ích khác', icon: 'layout-grid' }
  ];
  readonly parkingSlots = Array.from({ length: 23 }, (_, index) => index + 1);

  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly selectedVenueId = signal<string | null>(null);
  readonly courts = signal<OwnerVenueCourt[]>([]);
  readonly bookings = signal<OwnerBooking[]>([]);
  readonly courtBookings = signal<OwnerBooking[]>([]);
  readonly selectedBookingDate = signal(this.todayIso());
  readonly loading = signal(true);
  readonly courtLoading = signal(false);
  readonly bookingLoading = signal(false);
  readonly courtBookingLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly bookingError = signal<string | null>(null);
  readonly courtBookingError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly togglingId = signal<string | null>(null);
  readonly activeView = signal<WorkspaceView>('MAP');
  readonly panelMode = signal<PanelMode>('NONE');
  readonly selectedCourtId = signal<string | null>(null);
  readonly editingCourt = signal<OwnerVenueCourt | null>(null);
  readonly query = signal('');
  readonly sportFilter = signal<'ALL' | SportType>('ALL');
  readonly statusFilter = signal<OperationalFilter>('ALL');
  readonly filterOpen = signal(false);
  readonly venueMenuOpen = signal(false);
  readonly sportMenuOpen = signal(false);
  readonly actionMenuId = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = 8;
  readonly sortKey = signal<'NAME' | 'STATUS' | 'PRICE'>('NAME');
  readonly sortDirection = signal<'ASC' | 'DESC'>('ASC');

  readonly layout = signal<VenueFacilityLayout | null>(null);
  readonly draftLayout = signal<VenueFacilityLayout | null>(null);
  readonly layoutMode = signal(false);
  readonly layoutDirty = signal(false);
  readonly layoutHistory = signal<VenueFacilityLayout[]>([]);
  readonly layoutFuture = signal<VenueFacilityLayout[]>([]);
  readonly selectedLayoutItemId = signal<string | null>(null);
  readonly selectedLayoutZoneId = signal<string | null>(null);

  private pointerOperation: PointerOperation | null = null;
  private draggedLibraryType: FacilityObjectType | null = null;
  private courtsReadyForVenue: string | null = null;
  private bookingsReadyContext: string | null = null;
  private venueBookingRequestId = 0;
  private courtBookingRequestId = 0;
  private courtBookingContext: string | null = null;

  readonly venue = computed(() => this.venues().find(item => item.venueId === this.selectedVenueId()) ?? null);
  readonly editorOpen = computed(() => this.panelMode() === 'FORM');
  readonly displayLayout = computed(() => this.layoutMode() ? this.draftLayout() : this.layout());
  readonly canvasWidth = computed(() => this.canvasExtent('x'));
  readonly canvasHeight = computed(() => this.canvasExtent('y'));
  readonly canvasRenderWidth = computed(() => Math.round(760 * this.canvasWidth() / FACILITY_CANVAS_WIDTH));
  readonly canvasRenderHeight = computed(() => Math.round(575 * this.canvasHeight() / FACILITY_CANVAS_HEIGHT));
  readonly selectedCourt = computed(() => this.courts().find(court => court.venueCourtId === this.selectedCourtId()) ?? null);
  readonly selectedLayoutItem = computed(() => {
    const itemId = this.selectedLayoutItemId();
    return this.draftLayout()?.items.find(item => item.id === itemId) ?? null;
  });
  readonly selectedLayoutZone = computed(() => {
    const zoneId = this.selectedLayoutZoneId();
    return this.draftLayout()?.zones.find(zone => zone.id === zoneId) ?? null;
  });
  readonly courtLayoutItems = computed(() => this.displayLayout()?.items.filter(item => item.type === 'COURT') ?? []);
  readonly facilityLayoutItems = computed(() => this.displayLayout()?.items.filter(item => item.type !== 'COURT') ?? []);
  readonly unplacedCourts = computed(() => {
    const placed = new Set((this.draftLayout()?.items ?? []).filter(item => item.type === 'COURT').map(item => item.courtId));
    return this.courts().filter(court => !placed.has(court.venueCourtId));
  });
  readonly totalCapacity = computed(() => this.courts().reduce((sum, court) => sum + court.capacity, 0));
  readonly activeCount = computed(() => this.courts().filter(court => this.operationalStatus(court) === 'AVAILABLE').length);
  readonly occupiedCount = computed(() => this.courts().filter(court => this.operationalStatus(court) === 'OCCUPIED').length);
  readonly upcomingCount = computed(() => this.courts().filter(court => this.operationalStatus(court) === 'UPCOMING').length);
  readonly maintenanceCount = computed(() => this.courts().filter(court => this.operationalStatus(court) === 'MAINTENANCE').length);
  readonly courtTypeSummaries = computed<CourtTypeSummary[]>(() => {
    const summaries = new Map<string, CourtTypeSummary>();
    for (const court of this.courts()) {
      const surfaceType = court.surfaceType || 'Chưa cập nhật';
      const key = `${court.sportType}:${surfaceType}`;
      const current = summaries.get(key) ?? {
        key,
        sportType: court.sportType,
        surfaceType,
        courts: 0,
        capacity: 0,
        active: 0
      };
      current.courts += 1;
      current.capacity += court.capacity;
      current.active += court.active ? 1 : 0;
      summaries.set(key, current);
    }
    return [...summaries.values()].sort((a, b) => b.courts - a.courts);
  });
  readonly filteredCourts = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('vi');
    const filtered = this.courts().filter(court => {
      const searchable = [court.name, this.courtCode(court), court.surfaceType, this.sportLabel(court.sportType)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi');
      return (!query || searchable.includes(query))
        && (this.sportFilter() === 'ALL' || court.sportType === this.sportFilter())
        && (this.statusFilter() === 'ALL' || this.operationalStatus(court) === this.statusFilter());
    });
    const direction = this.sortDirection() === 'ASC' ? 1 : -1;
    return filtered.sort((a, b) => {
      if (this.sortKey() === 'STATUS') {
        return this.operationalLabel(a).localeCompare(this.operationalLabel(b), 'vi') * direction;
      }
      if (this.sortKey() === 'PRICE') {
        return ((this.courtPrice(a) ?? 0) - (this.courtPrice(b) ?? 0)) * direction;
      }
      return a.name.localeCompare(b.name, 'vi') * direction;
    });
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredCourts().length / this.pageSize)));
  readonly pagedCourts = computed(() => {
    const currentPage = Math.min(this.page(), this.pageCount());
    return this.filteredCourts().slice((currentPage - 1) * this.pageSize, currentPage * this.pageSize);
  });
  readonly resultStart = computed(() => this.filteredCourts().length
    ? (Math.min(this.page(), this.pageCount()) - 1) * this.pageSize + 1
    : 0);
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
    interval(60_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const venueId = this.selectedVenueId();
      if (venueId && !this.layoutMode()) {
        this.refreshCourts(venueId, false);
        this.loadBookingsForSelectedDate(venueId, false);
        const selectedCourt = this.selectedCourt();
        if (selectedCourt && this.panelMode() === 'DETAIL') {
          this.loadCourtBookings(selectedCourt.venueCourtId, false);
        }
      }
    });
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
    if (this.layoutMode() && !this.cancelLayoutEdit()) return;
    this.selectedVenueId.set(venueId);
    this.selectedBookingDate.set(this.todayIso());
    this.courtsReadyForVenue = null;
    this.bookingsReadyContext = null;
    this.closePanel();
    this.query.set('');
    this.sportFilter.set('ALL');
    this.statusFilter.set('ALL');
    this.page.set(1);
    this.refreshCourts(venueId, true);
    this.loadBookingsForSelectedDate(venueId, true);
  }

  selectVenueFromMenu(venueId: string): void {
    this.venueMenuOpen.set(false);
    this.selectVenue(venueId);
  }

  toggleVenueMenu(): void {
    const next = !this.venueMenuOpen();
    this.sportMenuOpen.set(false);
    this.filterOpen.set(false);
    this.venueMenuOpen.set(next);
  }

  toggleSportMenu(): void {
    const next = !this.sportMenuOpen();
    this.venueMenuOpen.set(false);
    this.filterOpen.set(false);
    this.sportMenuOpen.set(next);
  }

  toggleStatusMenu(): void {
    const next = !this.filterOpen();
    this.venueMenuOpen.set(false);
    this.sportMenuOpen.set(false);
    this.filterOpen.set(next);
  }

  setView(view: WorkspaceView): void {
    if (view === this.activeView()) return;
    if (this.layoutMode() && !this.cancelLayoutEdit()) return;
    this.activeView.set(view);
    this.closePanel();
    if (view === 'MAP') this.openDefaultCourtDetail();
  }

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    if (this.activeView() === 'MAP') {
      const matches = this.filteredCourts();
      if (matches.length === 1) this.selectedCourtId.set(matches[0].venueCourtId);
    }
  }

  setSportFilter(value: 'ALL' | SportType): void {
    this.sportFilter.set(value);
    this.sportMenuOpen.set(false);
    this.page.set(1);
  }

  sportFilterLabel(): string {
    if (this.sportFilter() === 'ALL') return 'Tất cả môn';
    return this.sports.find(option => option.value === this.sportFilter())?.label ?? 'Tất cả môn';
  }

  setStatusFilter(filter: OperationalFilter): void {
    this.statusFilter.set(filter);
    this.filterOpen.set(false);
    this.page.set(1);
  }

  statusFilterLabel(): string {
    return this.filterOptions.find(option => option.value === this.statusFilter())?.label ?? 'Tất cả trạng thái';
  }

  courtMatchesFilter(court: OwnerVenueCourt): boolean {
    return this.filteredCourts().some(item => item.venueCourtId === court.venueCourtId);
  }

  previousPage(): void {
    this.page.update(page => Math.max(1, page - 1));
  }

  nextPage(): void {
    this.page.update(page => Math.min(this.pageCount(), page + 1));
  }

  setSort(key: 'NAME' | 'STATUS' | 'PRICE'): void {
    if (this.sortKey() === key) this.sortDirection.update(direction => direction === 'ASC' ? 'DESC' : 'ASC');
    else {
      this.sortKey.set(key);
      this.sortDirection.set('ASC');
    }
    this.page.set(1);
  }

  selectCourt(court: OwnerVenueCourt): void {
    this.selectedCourtId.set(court.venueCourtId);
    if (this.layoutMode()) {
      this.selectedLayoutItemId.set(`court:${court.venueCourtId}`);
      return;
    }
    this.panelMode.set('DETAIL');
    this.loadCourtBookings(court.venueCourtId, true);
  }

  closePanel(): void {
    if (this.saving()) return;
    this.courtBookingRequestId += 1;
    this.courtBookingContext = null;
    this.courtBookings.set([]);
    this.courtBookingError.set(null);
    this.courtBookingLoading.set(false);
    this.panelMode.set('NONE');
    this.editingCourt.set(null);
    if (!this.layoutMode()) this.selectedCourtId.set(null);
  }

  changeBookingDate(event: Event): void {
    const date = (event.target as HTMLInputElement).value || this.todayIso();
    if (date === this.selectedBookingDate()) return;

    this.selectedBookingDate.set(date);
    this.bookingsReadyContext = null;
    this.bookings.set([]);
    const venueId = this.selectedVenueId();
    if (!venueId) return;

    this.loadBookingsForSelectedDate(venueId, true);
    const selectedCourt = this.selectedCourt();
    if (selectedCourt && this.panelMode() === 'DETAIL') {
      this.loadCourtBookings(selectedCourt.venueCourtId, true);
    }
  }

  openBookingDatePicker(event: Event): void {
    event.preventDefault();
    const input = this.bookingDateInput?.nativeElement;
    if (!input) return;

    input.focus({ preventScroll: true });
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      input.focus({ preventScroll: true });
    }
  }

  openCreate(): void {
    if (this.saving()) return;
    this.editingCourt.set(null);
    this.form.reset({ name: '', sportType: 'FOOTBALL', capacity: 1, surfaceType: '', active: true });
    this.form.markAsPristine();
    this.panelMode.set('FORM');
  }

  openEdit(court: OwnerVenueCourt): void {
    if (this.saving()) return;
    this.actionMenuId.set(null);
    this.selectedCourtId.set(court.venueCourtId);
    this.editingCourt.set(court);
    this.form.reset({
      name: court.name,
      sportType: court.sportType as SportType,
      capacity: court.capacity,
      surfaceType: court.surfaceType ?? '',
      active: court.active
    });
    this.form.markAsPristine();
    this.panelMode.set('FORM');
  }

  duplicateCourt(court: OwnerVenueCourt): void {
    if (this.saving()) return;
    this.actionMenuId.set(null);
    this.selectedCourtId.set(court.venueCourtId);
    this.editingCourt.set(null);
    this.form.reset({
      name: `${court.name} - Bản sao`,
      sportType: court.sportType as SportType,
      capacity: court.capacity,
      surfaceType: court.surfaceType ?? '',
      active: false
    });
    this.form.markAsDirty();
    this.panelMode.set('FORM');
  }

  closeEditor(): void {
    if (this.saving()) return;
    this.editingCourt.set(null);
    if (this.selectedCourt()) {
      this.panelMode.set('DETAIL');
    } else {
      this.panelMode.set('NONE');
      this.openDefaultCourtDetail();
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
        this.syncLayoutWithCourts();
        this.selectedCourtId.set(saved.venueCourtId);
        this.editingCourt.set(null);
        this.panelMode.set('DETAIL');
        this.loadCourtBookings(saved.venueCourtId, true);
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

  enterLayoutMode(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.notify.warning('Chỉnh bố cục cần màn hình tablet ngang hoặc desktop để thao tác chính xác.');
      return;
    }
    const current = this.layout();
    if (!current) return;
    this.closePanel();
    this.draftLayout.set(cloneFacilityLayout(current));
    this.layoutHistory.set([]);
    this.layoutFuture.set([]);
    this.layoutDirty.set(false);
    this.layoutMode.set(true);
    const firstCourt = current.items.find(item => item.type === 'COURT');
    this.selectedLayoutItemId.set(firstCourt?.id ?? current.items[0]?.id ?? null);
    this.selectedLayoutZoneId.set(null);
  }

  cancelLayoutEdit(): boolean {
    if (!this.layoutMode()) return true;
    if (this.layoutDirty() && !window.confirm('Bỏ các thay đổi chưa lưu trong bố cục sân?')) return false;
    this.layoutMode.set(false);
    this.layoutDirty.set(false);
    this.draftLayout.set(null);
    this.layoutHistory.set([]);
    this.layoutFuture.set([]);
    this.selectedLayoutItemId.set(null);
    this.selectedLayoutZoneId.set(null);
    this.openDefaultCourtDetail();
    return true;
  }

  saveLayout(): void {
    const draft = this.draftLayout();
    if (!draft) return;
    try {
      const saved = this.layoutStore.save(draft);
      this.layout.set(saved);
      this.layoutMode.set(false);
      this.layoutDirty.set(false);
      this.draftLayout.set(null);
      this.layoutHistory.set([]);
      this.layoutFuture.set([]);
      this.selectedLayoutItemId.set(null);
      this.selectedLayoutZoneId.set(null);
      this.openDefaultCourtDetail();
      this.notify.success('Bố cục cơ sở đã được lưu trên thiết bị này.');
    } catch {
      this.notify.error('Không thể lưu bố cục trên thiết bị. Vui lòng thử lại.');
    }
  }

  resetLayout(): void {
    const venueId = this.selectedVenueId();
    const draft = this.draftLayout();
    if (!venueId || !draft) return;
    this.pushLayoutHistory();
    this.draftLayout.set(createAutomaticFacilityLayout(venueId, this.courts()));
    this.layoutDirty.set(true);
    this.selectedLayoutItemId.set(null);
    this.selectedLayoutZoneId.set(null);
  }

  undoLayout(): void {
    const history = this.layoutHistory();
    const current = this.draftLayout();
    if (!history.length || !current) return;
    const previous = history[history.length - 1];
    this.layoutFuture.update(items => [cloneFacilityLayout(current), ...items].slice(0, 30));
    this.layoutHistory.set(history.slice(0, -1));
    this.draftLayout.set(cloneFacilityLayout(previous));
    this.layoutDirty.set(true);
  }

  redoLayout(): void {
    const future = this.layoutFuture();
    const current = this.draftLayout();
    if (!future.length || !current) return;
    const next = future[0];
    this.layoutHistory.update(items => [...items, cloneFacilityLayout(current)].slice(-30));
    this.layoutFuture.set(future.slice(1));
    this.draftLayout.set(cloneFacilityLayout(next));
    this.layoutDirty.set(true);
  }

  beginPointerOperation(event: PointerEvent, item: FacilityLayoutItem, mode: 'MOVE' | 'RESIZE'): void {
    if (!this.layoutMode() || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedLayoutItemId.set(item.id);
    this.selectedLayoutZoneId.set(null);
    if (item.courtId) this.selectedCourtId.set(item.courtId);
    this.pushLayoutHistory();
    this.pointerOperation = {
      itemId: item.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      canvasUnitsPerPixelX: this.canvasWidth() / Math.max(1, this.facilityCanvas?.nativeElement.getBoundingClientRect().width ?? 1),
      canvasUnitsPerPixelY: this.canvasHeight() / Math.max(1, this.facilityCanvas?.nativeElement.getBoundingClientRect().height ?? 1),
      target: 'ITEM',
      original: { ...item }
    };
  }

  beginZonePointerOperation(event: PointerEvent, zone: FacilityZone, mode: 'MOVE' | 'RESIZE'): void {
    if (!this.layoutMode() || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedLayoutItemId.set(null);
    this.selectedLayoutZoneId.set(zone.id);
    this.pushLayoutHistory();
    const rect = this.facilityCanvas?.nativeElement.getBoundingClientRect();
    this.pointerOperation = {
      itemId: zone.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      canvasUnitsPerPixelX: this.canvasWidth() / Math.max(1, rect?.width ?? 1),
      canvasUnitsPerPixelY: this.canvasHeight() / Math.max(1, rect?.height ?? 1),
      target: 'ZONE',
      original: { ...zone }
    };
  }

  selectLayoutItem(event: Event, item: FacilityLayoutItem): void {
    event.stopPropagation();
    this.selectedLayoutItemId.set(item.id);
    this.selectedLayoutZoneId.set(null);
    if (item.courtId) this.selectedCourtId.set(item.courtId);
  }

  clearLayoutSelection(): void {
    if (!this.layoutMode()) return;
    this.selectedLayoutItemId.set(null);
    this.selectedLayoutZoneId.set(null);
  }

  selectLayoutZone(event: Event, zone: FacilityZone): void {
    event.stopPropagation();
    this.selectedLayoutItemId.set(null);
    this.selectedLayoutZoneId.set(zone.id);
  }

  rotateSelected(): void {
    const item = this.selectedLayoutItem();
    if (!item) return;
    this.pushLayoutHistory();
    this.updateDraftItem(item.id, current => ({ ...current, rotation: (current.rotation + 90) % 360 }));
  }

  updateSelectedLabel(event: Event): void {
    const item = this.selectedLayoutItem();
    if (!item) return;
    this.pushLayoutHistory();
    const label = (event.target as HTMLInputElement).value.slice(0, 80);
    this.updateDraftItem(item.id, current => ({ ...current, label }));
  }

  updateSelectedNumber(field: 'x' | 'y' | 'width' | 'height' | 'rotation', event: Event): void {
    const item = this.selectedLayoutItem();
    if (!item) return;
    const raw = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(raw)) return;
    this.pushLayoutHistory();
    this.updateDraftItem(item.id, current => {
      const minimum = field === 'width' ? 90 : field === 'height' ? 55 : 0;
      const value = field === 'rotation'
        ? Math.max(0, Math.min(359, raw))
        : this.snap(Math.max(minimum, raw));
      return { ...current, [field]: value };
    });
  }

  updateSelectedZoneLabel(event: Event): void {
    const zone = this.selectedLayoutZone();
    if (!zone) return;
    this.pushLayoutHistory();
    const name = (event.target as HTMLInputElement).value.trim().slice(0, 80) || zone.name;
    this.updateDraftZone(zone.id, current => ({ ...current, name }));
  }

  updateSelectedZoneNumber(field: 'x' | 'y' | 'width' | 'height', event: Event): void {
    const zone = this.selectedLayoutZone();
    const raw = Number((event.target as HTMLInputElement).value);
    if (!zone || !Number.isFinite(raw)) return;
    this.pushLayoutHistory();
    this.updateDraftZone(zone.id, current => ({
      ...current,
      [field]: this.snap(Math.max(field === 'width' ? 220 : field === 'height' ? 180 : 0, raw))
    }));
  }

  removeSelectedZone(): void {
    const zone = this.selectedLayoutZone();
    const draft = this.draftLayout();
    if (!zone || !draft) return;
    this.pushLayoutHistory();
    this.draftLayout.set({
      ...draft,
      zones: draft.zones.filter(current => current.id !== zone.id),
      items: draft.items.map(item => item.zoneId === zone.id ? { ...item, zoneId: undefined } : item)
    });
    this.selectedLayoutZoneId.set(null);
    this.layoutDirty.set(true);
  }

  duplicateSelected(): void {
    const item = this.selectedLayoutItem();
    const draft = this.draftLayout();
    if (!item || !draft || item.type === 'COURT') return;
    this.pushLayoutHistory();
    const copy: FacilityLayoutItem = {
      ...item,
      id: `${item.type.toLowerCase()}:${Date.now()}`,
      label: `${item.label} mới`,
      x: item.x + 30,
      y: item.y + 30
    };
    this.draftLayout.set({ ...draft, items: [...draft.items, copy] });
    this.selectedLayoutItemId.set(copy.id);
    this.layoutDirty.set(true);
  }

  removeSelectedFromLayout(): void {
    const item = this.selectedLayoutItem();
    const draft = this.draftLayout();
    if (!item || !draft) return;
    this.pushLayoutHistory();
    this.draftLayout.set({ ...draft, items: draft.items.filter(current => current.id !== item.id) });
    this.selectedLayoutItemId.set(null);
    this.layoutDirty.set(true);
  }

  placeUnplacedCourt(court: OwnerVenueCourt): void {
    const draft = this.draftLayout();
    if (!draft) return;
    this.pushLayoutHistory();
    const index = draft.items.filter(item => item.type === 'COURT').length;
    const item: FacilityLayoutItem = {
      id: `court:${court.venueCourtId}`,
      type: 'COURT',
      courtId: court.venueCourtId,
      label: court.name,
      x: 230 + (index % 3) * 215,
      y: 80 + (Math.floor(index / 3) % 3) * 175,
      width: 190,
      height: 145,
      rotation: 0,
      zoneId: 'zone-a'
    };
    this.draftLayout.set({ ...draft, items: [...draft.items, item] });
    this.selectedLayoutItemId.set(item.id);
    this.selectedCourtId.set(court.venueCourtId);
    this.layoutDirty.set(true);
  }

  beginLibraryDrag(event: DragEvent, type: FacilityObjectType): void {
    this.draggedLibraryType = type;
    event.dataTransfer?.setData('text/plain', type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  allowLayoutDrop(event: DragEvent): void {
    if (!this.layoutMode()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  dropLibraryItem(event: DragEvent): void {
    event.preventDefault();
    const type = this.draggedLibraryType ?? event.dataTransfer?.getData('text/plain') as FacilityObjectType;
    this.draggedLibraryType = null;
    if (!type || !this.facilityCanvas) return;
    const rect = this.facilityCanvas.nativeElement.getBoundingClientRect();
    const x = this.snap((event.clientX - rect.left) / rect.width * this.canvasWidth() - 70);
    const y = this.snap((event.clientY - rect.top) / rect.height * this.canvasHeight() - 35);
    this.addFacility(type, x, y);
  }

  addFacility(type: FacilityObjectType, x = 420, y = 300): void {
    const draft = this.draftLayout();
    const libraryItem = this.layoutLibrary.find(item => item.type === type);
    if (!draft || !libraryItem) return;
    this.pushLayoutHistory();
    const count = draft.items.filter(item => item.type === type).length + 1;
    const item: FacilityLayoutItem = {
      id: `${type.toLowerCase()}:${Date.now()}`,
      type,
      label: count > 1 ? `${libraryItem.label} ${count}` : libraryItem.label,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: type === 'PARKING' ? 240 : 140,
      height: type === 'PARKING' ? 90 : 70,
      rotation: 0
    };
    this.draftLayout.set({ ...draft, items: [...draft.items, item] });
    this.selectedLayoutItemId.set(item.id);
    this.layoutDirty.set(true);
  }

  addZone(): void {
    const draft = this.draftLayout();
    if (!draft) return;
    this.pushLayoutHistory();
    const number = draft.zones.length + 1;
    const rightEdge = Math.max(FACILITY_CANVAS_WIDTH, ...draft.zones.map(zone => zone.x + zone.width));
    const zone: FacilityZone = {
      id: `zone:${Date.now()}`,
      name: `Khu ${number}`,
      x: this.snap(rightEdge + 40),
      y: 40,
      width: 360,
      height: 520
    };
    this.draftLayout.set({
      ...draft,
      zones: [...draft.zones, zone]
    });
    this.selectedLayoutItemId.set(null);
    this.selectedLayoutZoneId.set(zone.id);
    this.layoutDirty.set(true);
    requestAnimationFrame(() => {
      const scroll = this.facilityCanvas?.nativeElement.parentElement;
      scroll?.scrollTo?.({ left: scroll.scrollWidth, behavior: 'smooth' });
    });
  }

  courtForItem(item: FacilityLayoutItem): OwnerVenueCourt | null {
    return this.courts().find(court => court.venueCourtId === item.courtId) ?? null;
  }

  zoneForCourt(court: OwnerVenueCourt): string {
    const currentLayout = this.layout();
    const item = currentLayout?.items.find(candidate => candidate.courtId === court.venueCourtId);
    return currentLayout?.zones.find(zone => zone.id === item?.zoneId)?.name ?? 'Chưa phân khu';
  }

  facilityIcon(type: FacilityObjectType): string {
    return this.layoutLibrary.find(item => item.type === type)?.icon ?? 'layout-grid';
  }

  itemPercent(value: number, axis: 'x' | 'y'): number {
    return value / (axis === 'x' ? this.canvasWidth() : this.canvasHeight()) * 100;
  }

  sportLabel(value: string): string {
    return this.sports.find(option => option.value === value)?.label ?? value;
  }

  operationalStatus(court: OwnerVenueCourt): OperationalStatus {
    if (!court.active || court.availabilityStatus === 'INACTIVE') return 'DISABLED';
    if (court.availabilityStatus === 'MAINTENANCE') return 'MAINTENANCE';
    if (this.currentBooking(court.venueCourtId) || court.availabilityStatus === 'OCCUPIED') return 'OCCUPIED';
    if (this.nextBooking(court.venueCourtId, 120) || court.availabilityStatus === 'HELD') return 'UPCOMING';
    return 'AVAILABLE';
  }

  operationalLabel(court: OwnerVenueCourt): string {
    const labels: Record<OperationalStatus, string> = {
      AVAILABLE: 'Trống',
      OCCUPIED: 'Đang sử dụng',
      UPCOMING: 'Sắp có lịch',
      MAINTENANCE: 'Bảo trì',
      DISABLED: 'Tạm ngưng'
    };
    return labels[this.operationalStatus(court)];
  }

  currentBooking(courtId: string): OwnerBooking | null {
    if (this.selectedBookingDate() !== this.todayIso()) return null;
    const now = this.currentMinutes();
    return this.bookingsForCourt(courtId).find(booking =>
      ['CONFIRMED', 'CHECKED_IN'].includes(booking.status)
      && this.timeMinutes(booking.startTime) <= now
      && this.timeMinutes(booking.endTime) > now
    ) ?? null;
  }

  nextBooking(courtId: string, withinMinutes?: number): OwnerBooking | null {
    const selectedDate = this.selectedBookingDate();
    const today = this.todayIso();
    if (selectedDate < today) return null;
    const now = selectedDate === today ? this.currentMinutes() : -1;
    return this.bookingsForCourt(courtId).find(booking => {
      const startsIn = this.timeMinutes(booking.startTime) - now;
      return ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)
        && startsIn > 0
        && (withinMinutes === undefined || selectedDate > today || startsIn <= withinMinutes);
    }) ?? null;
  }

  bookingsForCourt(courtId: string): OwnerBooking[] {
    return this.bookings()
      .filter(booking => booking.venueCourtId === courtId && !['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  detailBookingsForCourt(courtId: string): OwnerBooking[] {
    if (this.courtBookingContext !== this.bookingContext(courtId, this.selectedBookingDate())) return [];
    return this.courtBookings()
      .filter(booking => booking.venueCourtId === courtId && !['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  detailCurrentBooking(courtId: string): OwnerBooking | null {
    if (this.selectedBookingDate() !== this.todayIso()) return null;
    const now = this.currentMinutes();
    return this.detailBookingsForCourt(courtId).find(booking =>
      ['CONFIRMED', 'CHECKED_IN'].includes(booking.status)
      && this.timeMinutes(booking.startTime) <= now
      && this.timeMinutes(booking.endTime) > now
    ) ?? null;
  }

  detailNextBooking(courtId: string): OwnerBooking | null {
    const selectedDate = this.selectedBookingDate();
    const today = this.todayIso();
    if (selectedDate < today) return null;
    const now = selectedDate === today ? this.currentMinutes() : -1;
    return this.detailBookingsForCourt(courtId).find(booking =>
      ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)
      && this.timeMinutes(booking.startTime) > now
    ) ?? null;
  }

  bookingDateLabel(): string {
    const [year, month, day] = this.selectedBookingDate().split('-');
    return `${day}/${month}/${year}`;
  }

  retryCourtBookings(courtId: string): void {
    this.loadCourtBookings(courtId, true);
  }

  bookingRange(booking: OwnerBooking | null): string {
    return booking ? `${booking.startTime.slice(0, 5)} – ${booking.endTime.slice(0, 5)}` : 'Chưa có';
  }

  bookingCustomer(booking: OwnerBooking | null): string {
    if (!booking) return '—';
    return booking.walkInCustomerName || booking.bookingCode;
  }

  bookingProgress(booking: OwnerBooking | null): number {
    if (!booking) return 0;
    const start = this.timeMinutes(booking.startTime);
    const end = this.timeMinutes(booking.endTime);
    return Math.max(0, Math.min(100, (this.currentMinutes() - start) / Math.max(1, end - start) * 100));
  }

  bookingRemaining(booking: OwnerBooking | null): string {
    if (!booking) return '';
    const minutes = Math.max(0, this.timeMinutes(booking.endTime) - this.currentMinutes());
    return `Còn ${minutes} phút`;
  }

  courtPrice(court: OwnerVenueCourt): number | null {
    const booking = this.nextBooking(court.venueCourtId) ?? this.currentBooking(court.venueCourtId);
    if (booking) {
      const minutes = this.timeMinutes(booking.endTime) - this.timeMinutes(booking.startTime);
      return minutes > 0 ? Math.round(booking.totalPrice / minutes * 60) : booking.totalPrice;
    }
    return this.venue()?.minPrice ?? null;
  }

  formatCurrency(value: number | null | undefined): string {
    return value === null || value === undefined ? 'Chưa cấu hình' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
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

  @HostListener('document:pointermove', ['$event'])
  handlePointerMove(event: PointerEvent): void {
    const operation = this.pointerOperation;
    const draft = this.draftLayout();
    if (!operation || !draft) return;
    const deltaX = (event.clientX - operation.startClientX) * operation.canvasUnitsPerPixelX;
    const deltaY = (event.clientY - operation.startClientY) * operation.canvasUnitsPerPixelY;
    if (operation.target === 'ZONE') {
      this.updateDraftZone(operation.itemId, zone => {
        if (operation.mode === 'MOVE') {
          return {
            ...zone,
            x: this.snap(Math.max(0, operation.original.x + deltaX)),
            y: this.snap(Math.max(0, operation.original.y + deltaY))
          };
        }
        return {
          ...zone,
          width: this.snap(Math.max(220, operation.original.width + deltaX)),
          height: this.snap(Math.max(180, operation.original.height + deltaY))
        };
      });
      return;
    }

    this.updateDraftItem(operation.itemId, item => {
      if (operation.mode === 'MOVE') {
        const x = this.snap(Math.max(0, operation.original.x + deltaX));
        const y = this.snap(Math.max(0, operation.original.y + deltaY));
        return { ...item, x, y };
      }
      const width = this.snap(Math.max(90, operation.original.width + deltaX));
      const height = this.snap(Math.max(55, operation.original.height + deltaY));
      return { ...item, width, height };
    });
  }

  @HostListener('document:pointerup')
  handlePointerUp(): void {
    this.pointerOperation = null;
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.venueMenuOpen.set(false);
    this.sportMenuOpen.set(false);
    this.filterOpen.set(false);
    this.actionMenuId.set(null);
    if (this.editorOpen()) this.closeEditor();
  }

  @HostListener('document:click')
  handleDocumentClick(): void {
    this.venueMenuOpen.set(false);
    this.sportMenuOpen.set(false);
    this.filterOpen.set(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.layoutMode() || !this.layoutDirty()) return;
    event.preventDefault();
  }

  private refreshCourts(venueId: string, showLoading: boolean): void {
    if (showLoading) this.courtLoading.set(true);
    this.loadError.set(null);
    this.manageCourts.list(venueId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.courtLoading.set(false))
    ).subscribe({
      next: courts => {
        this.courts.set(this.sortCourts(courts));
        this.courtsReadyForVenue = venueId;
        this.syncLayoutWithCourts();
        this.openDefaultCourtDetail();
      },
      error: error => {
        if (showLoading) this.courts.set([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải danh sách sân của cơ sở đã chọn.'));
      }
    });
  }

  private loadBookingsForSelectedDate(venueId: string, showLoading: boolean): void {
    const date = this.selectedBookingDate();
    const context = this.bookingContext(venueId, date);
    const requestId = ++this.venueBookingRequestId;
    if (showLoading) this.bookingLoading.set(true);
    this.bookingError.set(null);
    this.loadAllBookings({ venueId, fromDate: date, toDate: date }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (requestId === this.venueBookingRequestId) this.bookingLoading.set(false);
      })
    ).subscribe({
      next: bookings => {
        if (requestId !== this.venueBookingRequestId || context !== this.bookingContext(venueId, this.selectedBookingDate())) return;
        this.bookings.set(bookings);
        this.bookingsReadyContext = context;
        this.openDefaultCourtDetail();
      },
      error: error => {
        if (requestId !== this.venueBookingRequestId || context !== this.bookingContext(venueId, this.selectedBookingDate())) return;
        this.bookings.set([]);
        this.bookingsReadyContext = context;
        this.bookingError.set(this.errorMessage(error, 'Chưa thể đồng bộ lịch đặt sân theo ngày đã chọn.'));
        this.openDefaultCourtDetail();
      }
    });
  }

  private loadCourtBookings(courtId: string, showLoading: boolean): void {
    const venueId = this.selectedVenueId();
    if (!venueId) return;

    const date = this.selectedBookingDate();
    const context = this.bookingContext(courtId, date);
    const requestId = ++this.courtBookingRequestId;
    this.courtBookingContext = null;
    this.courtBookings.set([]);
    this.courtBookingError.set(null);
    if (showLoading) this.courtBookingLoading.set(true);

    this.loadAllBookings({ venueId, venueCourtId: courtId, fromDate: date, toDate: date }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (requestId === this.courtBookingRequestId) this.courtBookingLoading.set(false);
      })
    ).subscribe({
      next: bookings => {
        if (requestId !== this.courtBookingRequestId || context !== this.bookingContext(courtId, this.selectedBookingDate())) return;
        this.courtBookingContext = context;
        this.courtBookings.set(bookings);
      },
      error: error => {
        if (requestId !== this.courtBookingRequestId || context !== this.bookingContext(courtId, this.selectedBookingDate())) return;
        this.courtBookingContext = context;
        this.courtBookings.set([]);
        this.courtBookingError.set(this.errorMessage(error, 'Chưa thể tải lịch đặt của sân trong ngày đã chọn.'));
      }
    });
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

  private bookingContext(id: string, date: string): string {
    return `${id}:${date}`;
  }

  private syncLayoutWithCourts(): void {
    const venueId = this.selectedVenueId();
    if (!venueId || this.layoutMode()) return;
    this.layout.set(this.layoutStore.load(venueId, this.courts()));
  }

  private openDefaultCourtDetail(): void {
    const venueId = this.selectedVenueId();
    const bookingContext = venueId ? this.bookingContext(venueId, this.selectedBookingDate()) : null;
    if (!venueId || this.courtsReadyForVenue !== venueId || this.bookingsReadyContext !== bookingContext) return;
    if (this.activeView() !== 'MAP' || this.layoutMode() || this.panelMode() !== 'NONE' || !this.courts().length) return;
    this.selectCourt(this.courts()[0]);
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

  private updateDraftItem(itemId: string, update: (item: FacilityLayoutItem) => FacilityLayoutItem): void {
    const draft = this.draftLayout();
    if (!draft) return;
    this.draftLayout.set({
      ...draft,
      items: draft.items.map(item => item.id === itemId ? update(item) : item)
    });
    this.layoutDirty.set(true);
  }

  private updateDraftZone(zoneId: string, update: (zone: FacilityZone) => FacilityZone): void {
    const draft = this.draftLayout();
    if (!draft) return;
    this.draftLayout.set({
      ...draft,
      zones: draft.zones.map(zone => zone.id === zoneId ? update(zone) : zone)
    });
    this.layoutDirty.set(true);
  }

  private canvasExtent(axis: 'x' | 'y'): number {
    const layout = this.displayLayout();
    const base = axis === 'x' ? FACILITY_CANVAS_WIDTH : FACILITY_CANVAS_HEIGHT;
    if (!layout) return base;
    const furthest = axis === 'x'
      ? Math.max(0, ...layout.items.map(item => item.x + item.width), ...layout.zones.map(zone => zone.x + zone.width))
      : Math.max(0, ...layout.items.map(item => item.y + item.height), ...layout.zones.map(zone => zone.y + zone.height));
    if (furthest <= base) return base;
    return Math.ceil((furthest + 40) / FACILITY_GRID_SIZE) * FACILITY_GRID_SIZE;
  }

  private pushLayoutHistory(): void {
    const draft = this.draftLayout();
    if (!draft) return;
    const history = this.layoutHistory();
    const last = history[history.length - 1];
    if (!last || JSON.stringify(last) !== JSON.stringify(draft)) {
      this.layoutHistory.set([...history, cloneFacilityLayout(draft)].slice(-30));
    }
    this.layoutFuture.set([]);
  }

  private snap(value: number): number {
    return Math.round(value / FACILITY_GRID_SIZE) * FACILITY_GRID_SIZE;
  }

  private sortCourts(courts: OwnerVenueCourt[]): OwnerVenueCourt[] {
    return [...courts].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  private todayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private currentMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  private timeMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
