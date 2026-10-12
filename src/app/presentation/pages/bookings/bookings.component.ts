import { PAGE_SIZE } from '@shared/constants/page-size';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { OwnerBooking, OwnerBookingStatus, OwnerPayment } from '@application/dto/owner-booking/owner-booking.dto';
import { ADMIN_BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-booking.repository';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { NotifyService } from '@shared/components/notify/notify.service';
import { downloadBlob } from '@shared/utils/file.utils';
import { MatMenuModule } from '@angular/material/menu';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

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
  imports: [DatePickerComponent, DatePipe, FormsModule, MatMenuModule, LucideIconComponent, LoadingSkeletonComponent,
    PaginationComponent, SelectComponent]
})
export class AdminBookingsComponent implements OnInit {
  private readonly repository = inject(ADMIN_BOOKING_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(NotifyService);
  private readonly search$ = new Subject<string>();
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly statusMeta = STATUS_META;
  readonly statusOptions: readonly SelectOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    ...(Object.keys(STATUS_META) as OwnerBookingStatus[]).map(value => ({ value, label: STATUS_META[value].label }))
  ];
  readonly exportFormats = [
    { value: 'xlsx', label: 'Excel (.xlsx)', icon: 'file-spreadsheet' },
    { value: 'pdf', label: 'PDF', icon: 'file-text' }
  ] as const;
  readonly exporting = signal<'xlsx' | 'pdf' | null>(null);

  readonly status = signal<OwnerBookingStatus | ''>('');
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

  readonly hasFilters = computed(() => !!(this.status() || this.keyword() || this.fromDate() || this.toDate()));

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
  }

  onKeyword(value: string): void { this.search$.next(value); }

  setStatus(value: OwnerBookingStatus | ''): void {
    this.status.set(value);
    this.reload();
  }

  setDate(which: 'from' | 'to', value: string): void {
    (which === 'from' ? this.fromDate : this.toDate).set(value);
    this.reload();
  }

  clearFilters(): void {
    this.status.set('');
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

  /** Xuất đúng bộ lọc đang xem (trạng thái, từ khóa, khoảng ngày), mọi trang. */
  exportReport(format: 'xlsx' | 'pdf'): void {
    if (this.exporting()) return;
    this.exporting.set(format);
    this.repository.exportReport(this.currentFilter(), format)
      .pipe(finalize(() => this.exporting.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: file => {
          if (!file.size) { this.notify.error('Dịch vụ báo cáo không trả dữ liệu.'); return; }
          downloadBlob(file, `don-dat-san-${new Date().toISOString().slice(0, 10)}.${format}`);
          this.notify.success('Đã xuất báo cáo đơn đặt sân.');
        },
        error: () => this.notify.error('Không xuất được báo cáo. Nếu quá 10.000 đơn, hãy thu hẹp khoảng ngày.')
      });
  }

  open(booking: OwnerBooking): void { this.selected.set(booking); }

  private currentFilter() {
    return {
      status: this.status() || undefined,
      query: this.keyword() || undefined,
      fromDate: this.fromDate() || undefined,
      toDate: this.toDate() || undefined
    };
  }
  close(): void { this.selected.set(null); }

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
