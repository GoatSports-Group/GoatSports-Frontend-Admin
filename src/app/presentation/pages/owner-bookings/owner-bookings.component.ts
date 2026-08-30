import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize, of, switchMap, take } from 'rxjs';
import {
  OwnerBooking,
  OwnerBookingFilter,
  OwnerBookingStatus,
  OwnerPayment
} from '@application/dto/owner-booking/owner-booking.dto';
import {
  OwnerVenueCourt,
  OwnerVenueOverview
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

interface StatusOption { value: '' | OwnerBookingStatus; label: string; }
interface TimelineEntry { label: string; detail: string; time?: string; state: string; }

@Component({
  selector: 'app-owner-bookings',
  standalone: true,
  imports: [ReactiveFormsModule, LucideIconComponent],
  templateUrl: './owner-bookings.component.html',
  styleUrl: './owner-bookings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerBookingsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses: readonly StatusOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'CHECKED_IN', label: 'Đã check-in' },
    { value: 'COMPLETED', label: 'Hoàn tất' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'REFUND_PENDING', label: 'Chờ hoàn tiền' },
    { value: 'REFUNDED', label: 'Đã hoàn tiền' },
    { value: 'EXPIRED', label: 'Hết hạn' }
  ];
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly courts = signal<OwnerVenueCourt[]>([]);
  readonly bookings = signal<OwnerBooking[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pages = signal(0);
  readonly contextLoading = signal(true);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly selectedBooking = signal<OwnerBooking | null>(null);
  readonly requestedBookingId = signal<string | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly completingId = signal<string | null>(null);

  readonly filterForm = this.formBuilder.nonNullable.group({
    venueId: [''], venueCourtId: [''], status: ['' as '' | OwnerBookingStatus],
    query: [''], fromDate: [''], toDate: ['']
  });
  readonly selectedVenue = computed(() =>
    this.venues().find(venue => venue.venueId === this.filterForm.controls.venueId.value) ?? null
  );

  constructor() { this.loadContext(); }

  loadContext(): void {
    this.contextLoading.set(true);
    this.loadError.set(null);
    this.getVenues.execute().pipe(
      take(1),
      switchMap(venues => {
        this.venues.set(venues);
        const venueId = venues[0]?.venueId ?? '';
        this.filterForm.controls.venueId.setValue(venueId);
        return venueId ? this.manageCourts.list(venueId) : of([] as OwnerVenueCourt[]);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.contextLoading.set(false))
    ).subscribe({
      next: courts => { this.courts.set(courts); this.loadBookings(0); },
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải cơ sở của bạn.'))
    });
  }

  selectVenue(venueId: string): void {
    if (this.loading() || this.contextLoading()) return;
    this.filterForm.patchValue({ venueId, venueCourtId: '' });
    this.contextLoading.set(true);
    this.manageCourts.list(venueId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.contextLoading.set(false))
    ).subscribe({
      next: courts => { this.courts.set(courts); this.loadBookings(0); },
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải sân thi đấu.'))
    });
  }

  applyFilters(): void {
    const value = this.filterForm.getRawValue();
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      this.notify.error('Khoảng ngày booking chưa hợp lệ.');
      return;
    }
    this.loadBookings(0);
  }

  clearFilters(): void {
    const venueId = this.filterForm.controls.venueId.value;
    this.filterForm.reset({ venueId, venueCourtId: '', status: '', query: '', fromDate: '', toDate: '' });
    this.loadBookings(0);
  }

  loadBookings(page = this.page()): void {
    const venueId = this.filterForm.controls.venueId.value;
    if (!venueId) {
      this.bookings.set([]); this.total.set(0); this.pages.set(0); return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.manageBookings.list(this.filter(page)).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => {
        this.bookings.set(result.items); this.total.set(result.total);
        this.page.set(result.page); this.pages.set(result.pages);
      },
      error: error => {
        this.bookings.set([]); this.total.set(0); this.pages.set(0);
        this.loadError.set(this.errorMessage(error, 'Không thể tải danh sách booking.'));
      }
    });
  }

  openDetail(bookingId: string): void {
    if (this.detailLoading()) return;
    this.selectedBooking.set(null);
    this.requestedBookingId.set(bookingId);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.manageBookings.detail(bookingId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.detailLoading.set(false))
    ).subscribe({
      next: booking => this.selectedBooking.set(booking),
      error: error => this.detailError.set(this.errorMessage(error, 'Không thể tải chi tiết booking.'))
    });
  }

  retryDetail(bookingId: string): void { this.openDetail(bookingId); }
  closeDetail(): void {
    if (this.completingId()) return;
    this.selectedBooking.set(null); this.requestedBookingId.set(null); this.detailError.set(null);
  }

  completeBooking(booking: OwnerBooking): void {
    if (this.completingId() || !booking.allowedTransitions.includes('COMPLETED')) return;
    if (!window.confirm(`Xác nhận booking ${booking.bookingCode} đã hoàn tất sau giờ chơi?`)) return;
    this.completingId.set(booking.bookingId);
    this.manageBookings.updateStatus(booking.bookingId, 'COMPLETED').pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.completingId.set(null))
    ).subscribe({
      next: updated => {
        this.bookings.update(items => items.map(item => item.bookingId === updated.bookingId ? updated : item));
        this.selectedBooking.set(updated);
        this.notify.success('Booking đã được đánh dấu hoàn tất.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể hoàn tất booking.'))
    });
  }

  statusLabel(status: string): string {
    return this.statuses.find(item => item.value === status)?.label ?? status;
  }
  paymentFor(booking: OwnerBooking, purpose: OwnerPayment['purpose']): OwnerPayment | undefined {
    return booking.payments.find(payment => payment.purpose === purpose);
  }
  formatMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }
  formatDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
  }
  formatDateTime(value?: string): string {
    return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
  }
  timeValue(value: string): string { return value.slice(0, 5); }
  shortId(value?: string): string { return value ? value.slice(0, 8).toUpperCase() : 'WALK-IN'; }

  timeline(booking: OwnerBooking): TimelineEntry[] {
    const entries: TimelineEntry[] = [{
      label: 'Đã tạo booking', detail: booking.source, time: booking.createdAt, state: 'CREATED'
    }];
    for (const payment of booking.payments) {
      entries.push({
        label: payment.purpose === 'BOOKING_DEPOSIT' ? 'Thanh toán tiền cọc' : 'Thanh toán còn lại',
        detail: payment.status, time: payment.paidAt ?? payment.createdAt, state: payment.status
      });
    }
    entries.push({
      label: 'Trạng thái booking', detail: this.statusLabel(booking.status),
      time: booking.updatedAt, state: booking.status
    });
    return entries;
  }

  private filter(page: number): OwnerBookingFilter {
    const value = this.filterForm.getRawValue();
    return {
      venueId: value.venueId || undefined, venueCourtId: value.venueCourtId || undefined,
      status: value.status || undefined, query: value.query.trim() || undefined,
      fromDate: value.fromDate || undefined, toDate: value.toDate || undefined,
      page, size: 12
    };
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
