import { PAGE_SIZE } from '@shared/constants/page-size';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { OwnerBooking, OwnerBookingStatus, OwnerPayment } from '@application/dto/owner-booking/owner-booking.dto';
import { ADMIN_BOOKING_REPOSITORY_TOKEN, AdminBookingCriteria } from '@application/ports/persistence/admin-booking.repository';
import { ADMIN_VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-venue.repository';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { ExportFormatOption, ReportExportsComponent } from '@shared/components/report-exports/report-exports.component';
import { ReportExportFormat } from '@application/ports/persistence/report-export.repository';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

const EXPORT_FORMATS: readonly ExportFormatOption[] = [
  { value: 'xlsx', label: 'Excel · danh sách đơn', hint: 'Mọi đơn khớp bộ lọc, mỗi đơn một dòng; lọc và tính toán tiếp được.', icon: 'file-spreadsheet' },
  { value: 'pdf', label: 'PDF · báo cáo tổng hợp', hint: 'Tổng đơn, giá trị, đã thu, tỉ lệ không thành; theo trạng thái, cơ sở, nguồn đặt. Để in hoặc gửi.', icon: 'file-text' }
];

const STATUS_META: Record<OwnerBookingStatus, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'primary' },
  CHECKED_IN: { label: 'Đã nhận sân', tone: 'info' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  REFUND_PENDING: { label: 'Chờ hoàn tiền', tone: 'warning' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'neutral' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  NO_SHOW: { label: 'Không đến nhận sân', tone: 'neutral' }
};

/** Đơn đặt sân của mọi cơ sở trên nền tảng. Admin chỉ xem; duyệt hủy, thu tiền, check-in vẫn là việc của chủ sân. */
@Component({
  selector: 'app-admin-bookings',
  templateUrl: './bookings.component.html',
  styleUrls: ['./bookings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePickerComponent, DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent,
    PaginationComponent, SelectComponent, ReportExportsComponent]
})
export class AdminBookingsComponent implements OnInit {
  private readonly repository = inject(ADMIN_BOOKING_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly venueRepository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly search$ = new Subject<string>();
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly statusMeta = STATUS_META;
  readonly statusOptions: readonly SelectOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    ...(Object.keys(STATUS_META) as OwnerBookingStatus[]).map(value => ({ value, label: STATUS_META[value].label }))
  ];
  readonly status = signal<OwnerBookingStatus | ''>('');
  readonly venueId = signal('');
  readonly venueCourtId = signal('');
  private readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly venueOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Tất cả cơ sở' },
    ...this.venues().map(venue => ({ value: venue.venueId, label: venue.name }))
  ]);
  /** Sân của cơ sở đang chọn (chưa chọn cơ sở thì chỉ có "Tất cả sân"). */
  readonly courtOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Tất cả sân' },
    ...(this.venues().find(venue => venue.venueId === this.venueId())?.courts ?? [])
      .map(court => ({ value: court.venueCourtId, label: court.name }))
  ]);
  readonly keyword = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly pageIndex = signal(0);

  readonly items = signal<OwnerBooking[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly selected = signal<OwnerBooking | null>(null);

  readonly exportFormats = EXPORT_FORMATS;
  /** Bộ lọc đang xem, gửi nguyên cho báo cáo xuất ở nền. */
  readonly exportCriteria = computed<AdminBookingCriteria>(() => this.currentFilter());
  readonly exportRequest = (format: ReportExportFormat) =>
    this.repository.requestExport(this.exportCriteria(), format, this.exportLabels());
  readonly exportLabels = computed(() => ({
    venueName: this.venueOptions().find(option => option.value === this.venueId())?.label,
    courtName: this.courtOptions().find(option => option.value === this.venueCourtId())?.label
  }));
  /** Phạm vi đọc được để người dùng xác nhận trước khi xuất. */
  readonly exportScope = computed<string[]>(() => {
    const labels = this.exportLabels();
    const scope: string[] = [];
    if (this.venueId() && labels.venueName) scope.push(labels.venueName + (this.venueCourtId() && labels.courtName ? ' · ' + labels.courtName : ''));
    if (this.status()) scope.push(STATUS_META[this.status() as OwnerBookingStatus].label);
    if (this.fromDate() || this.toDate()) scope.push(`${this.shortDate(this.fromDate()) || '…'} – ${this.shortDate(this.toDate()) || '…'}`);
    if (this.keyword()) scope.push(`"${this.keyword()}"`);
    return scope;
  });

  readonly hasFilters = computed(() => !!(this.status() || this.venueId() || this.keyword() || this.fromDate() || this.toDate()));

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
    this.loadVenues();
  }

  onKeyword(value: string): void { this.search$.next(value); }

  setStatus(value: OwnerBookingStatus | ''): void {
    this.status.set(value);
    this.reload();
  }

  setVenue(value: string): void {
    this.venueId.set(value ?? '');
    this.venueCourtId.set('');
    this.reload();
  }

  setCourt(value: string): void {
    this.venueCourtId.set(value ?? '');
    this.reload();
  }

  setDate(which: 'from' | 'to', value: string): void {
    (which === 'from' ? this.fromDate : this.toDate).set(value);
    this.reload();
  }

  clearFilters(): void {
    this.status.set('');
    this.venueId.set('');
    this.venueCourtId.set('');
    this.keyword.set('');
    this.fromDate.set('');
    this.toDate.set('');
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
    this.request = this.repository.getBookings({ ...this.currentFilter(), page: this.pageIndex(), size: this.pageSize }).pipe(finalize(() => { this.loading.set(false); this.paging.set(false); }))
      .subscribe({
        next: page => {
          this.items.set(page.items);
          this.total.set(page.total);
        },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được danh sách đơn đặt sân.')
      });
  }

  open(booking: OwnerBooking): void { this.selected.set(booking); }

  /** Danh sách cơ sở cho bộ lọc (kèm sân của từng cơ sở). */
  // ponytail: tải 50 cơ sở đầu (giới hạn trang của API admin); cần ô tìm gọi server khi nền tảng vượt 50 cơ sở.
  private loadVenues(): void {
    this.venueRepository.getVenues({ page: 0, size: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => this.venues.set([...page.items].sort((a, b) => a.name.localeCompare(b.name, 'vi'))),
        error: () => this.venues.set([])
      });
  }

  private currentFilter() {
    return {
      venueId: this.venueId() || undefined,
      venueCourtId: this.venueCourtId() || undefined,
      status: this.status() || undefined,
      query: this.keyword() || undefined,
      fromDate: this.fromDate() || undefined,
      toDate: this.toDate() || undefined
    };
  }
  close(): void { this.selected.set(null); }

  private shortDate(value: string): string {
    return value ? value.split('-').reverse().join('/') : '';
  }

  customerName(booking: OwnerBooking): string {
    return booking.walkInCustomerName?.trim() || `Khách #${(booking.playerId ?? '').slice(0, 8)}`;
  }

  sourceLabel(source: OwnerBooking['source']): string {
    return source === 'WALK_IN' ? 'Khách tại quầy' : source === 'DIRECT' ? 'Đặt trực tuyến' : 'Ghép trận AI';
  }

  paidAmount(booking: OwnerBooking): number {
    return booking.payments.filter(item => item.status === 'SUCCEEDED').reduce((sum, item) => sum + item.amount, 0);
  }

  paymentLabel(payment: OwnerPayment): string {
    const purpose = payment.purpose === 'BOOKING_DEPOSIT' ? 'Tiền cọc' : 'Phần còn lại';
    const via = payment.method === 'CASH' ? 'tiền mặt' : payment.provider === 'PAYOS' ? 'payOS' : '';
    return via ? `${purpose} · ${via}` : purpose;
  }

  paymentStatus(status: string): { label: string; tone: Tone } {
    switch (status) {
      case 'SUCCEEDED': return { label: 'Đã thanh toán', tone: 'success' };
      case 'PENDING': case 'PROCESSING': return { label: 'Đang chờ', tone: 'warning' };
      case 'REFUNDED': return { label: 'Đã hoàn', tone: 'neutral' };
      default: return { label: 'Không thành công', tone: 'danger' };
    }
  }

  vnd(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(value ?? 0))} ₫`;
  }

  time(value: string): string { return value?.slice(0, 5) ?? ''; }
}
