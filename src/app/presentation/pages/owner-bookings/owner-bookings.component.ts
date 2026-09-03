import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, catchError, filter, finalize, map, of, switchMap, take, takeUntil, timer } from 'rxjs';
import { toDataURL } from 'qrcode';
import {
  OwnerBooking,
  OwnerBookingFilter,
  OwnerBookingStatus,
  OwnerPayment,
  OwnerBookingPaymentMethod
} from '@application/dto/owner-booking/owner-booking.dto';
import { OwnerTimeSlot } from '@application/dto/owner-schedule/owner-schedule.dto';
import {
  OwnerVenueCourt,
  OwnerVenueOverview
} from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

interface StatusOption { value: '' | OwnerBookingStatus; label: string; }
interface TimelineEntry { label: string; detail: string; time?: string; state: string; }

@Component({
  selector: 'app-owner-bookings',
  standalone: true,
  imports: [ReactiveFormsModule, LucideIconComponent, PageLoadingComponent],
  templateUrl: './owner-bookings.component.html',
  styleUrl: './owner-bookings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerBookingsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageCourts = inject(ManageOwnerVenueCourtsUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
  private readonly manageSchedule = inject(ManageOwnerScheduleUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly requestedVenueId = this.route.snapshot.queryParamMap.get('venueId') ?? '';
  private readonly requestedCourtId = this.route.snapshot.queryParamMap.get('venueCourtId') ?? '';
  private readonly requestedAction = this.route.snapshot.queryParamMap.get('action') ?? '';
  private routeActionHandled = false;

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
  readonly createOpen = signal(false);
  readonly createCourts = signal<OwnerVenueCourt[]>([]);
  readonly createSlots = signal<OwnerTimeSlot[]>([]);
  readonly createLoading = signal(false);
  readonly slotsLoading = signal(false);
  readonly paymentBooking = signal<OwnerBooking | null>(null);
  readonly paymentLoading = signal<OwnerBookingPaymentMethod | null>(null);
  readonly checkoutQr = signal<string | null>(null);
  readonly checkoutUrl = signal<string | null>(null);
  readonly bookingTicketQr = signal<string | null>(null);
  readonly paymentCompleted = signal(false);
  private readonly stopPaymentPolling = new Subject<void>();

  readonly filterForm = this.formBuilder.nonNullable.group({
    venueId: [''], venueCourtId: [''], status: ['' as '' | OwnerBookingStatus],
    query: [''], fromDate: [''], toDate: ['']
  });
  readonly createForm = this.formBuilder.nonNullable.group({
    venueId: ['', Validators.required],
    venueCourtId: ['', Validators.required],
    playDate: [this.today(), Validators.required],
    timeSlotId: ['', Validators.required],
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    customerPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 .-]{8,20}$/)]]
  });
  readonly selectedCreateSlotId = toSignal(
    this.createForm.controls.timeSlotId.valueChanges,
    { initialValue: this.createForm.controls.timeSlotId.value }
  );
  readonly currentTimestamp = toSignal(
    timer(0, 30_000).pipe(map(() => Date.now())),
    { initialValue: Date.now() }
  );
  readonly selectedVenue = computed(() =>
    this.venues().find(venue => venue.venueId === this.filterForm.controls.venueId.value) ?? null
  );
  readonly availableCreateSlots = computed(() =>
    this.createSlots().filter(slot =>
      slot.status === 'AVAILABLE' && this.slotEndTimestamp(slot) > this.currentTimestamp()
    )
  );
  readonly selectedCreateSlot = computed(() => {
    const slotId = this.selectedCreateSlotId();
    return this.availableCreateSlots().find(slot => slot.timeSlotId === slotId) ?? null;
  });

  constructor() { this.loadContext(); }

  loadContext(): void {
    this.contextLoading.set(true);
    this.loadError.set(null);
    this.getVenues.execute().pipe(
      take(1),
      switchMap(venues => {
        this.venues.set(venues);
        const venueId = venues.some(venue => venue.venueId === this.requestedVenueId)
          ? this.requestedVenueId
          : venues[0]?.venueId ?? '';
        this.filterForm.controls.venueId.setValue(venueId);
        return venueId ? this.manageCourts.list(venueId) : of([] as OwnerVenueCourt[]);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.contextLoading.set(false))
    ).subscribe({
      next: courts => {
        this.courts.set(courts);
        const courtId = courts.some(court => court.venueCourtId === this.requestedCourtId)
          ? this.requestedCourtId
          : '';
        this.filterForm.controls.venueCourtId.setValue(courtId);
        this.loadBookings(0);
        if (!this.routeActionHandled && this.requestedAction === 'walk-in') {
          this.routeActionHandled = true;
          this.openCreateBooking(courtId);
        }
      },
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

  openCreateBooking(preferredCourtId = ''): void {
    const venueId = this.filterForm.controls.venueId.value || this.venues()[0]?.venueId || '';
    const courts = venueId === this.filterForm.controls.venueId.value ? this.courts() : [];
    const selectedCourtId = courts.some(court => court.venueCourtId === preferredCourtId)
      ? preferredCourtId
      : courts.some(court => court.venueCourtId === this.filterForm.controls.venueCourtId.value)
        ? this.filterForm.controls.venueCourtId.value
        : courts[0]?.venueCourtId ?? '';
    this.createCourts.set(courts);
    this.createSlots.set([]);
    this.createForm.reset({
      venueId,
      venueCourtId: selectedCourtId,
      playDate: this.today(),
      timeSlotId: '',
      customerName: '',
      customerPhone: ''
    });
    this.createOpen.set(true);
    if (courts.length) this.loadCreateSlots();
    else if (venueId) this.selectCreateVenue(venueId);
  }

  closeCreateBooking(): void {
    if (!this.createLoading()) this.createOpen.set(false);
  }

  selectCreateVenue(venueId: string): void {
    if (this.createLoading()) return;
    this.createForm.patchValue({ venueId, venueCourtId: '', timeSlotId: '' });
    this.createCourts.set([]);
    this.createSlots.set([]);
    this.slotsLoading.set(true);
    this.manageCourts.list(venueId).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.slotsLoading.set(false))
    ).subscribe({
      next: courts => {
        this.createCourts.set(courts);
        this.createForm.controls.venueCourtId.setValue(courts[0]?.venueCourtId ?? '');
        this.loadCreateSlots();
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể tải sân thi đấu.'))
    });
  }

  loadCreateSlots(): void {
    const courtId = this.createForm.controls.venueCourtId.value;
    const date = this.createForm.controls.playDate.value;
    this.createForm.controls.timeSlotId.setValue('');
    this.createSlots.set([]);
    if (!courtId || !date) return;
    this.slotsLoading.set(true);
    this.manageSchedule.listSlots(courtId, date, date).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.slotsLoading.set(false))
    ).subscribe({
      next: slots => this.createSlots.set(slots),
      error: error => this.notify.error(this.errorMessage(error, 'Không thể tải khung giờ khả dụng.'))
    });
  }

  createWalkInBooking(): void {
    if (this.createLoading() || this.createForm.invalid || !this.selectedCreateSlot()) {
      this.createForm.markAllAsTouched();
      if (this.createForm.controls.timeSlotId.value && !this.selectedCreateSlot()) {
        this.createForm.controls.timeSlotId.setValue('');
        this.notify.error('Khung giờ đã kết thúc hoặc không còn khả dụng. Vui lòng chọn khung giờ khác.');
        this.loadCreateSlots();
      }
      return;
    }
    const value = this.createForm.getRawValue();
    this.createLoading.set(true);
    this.manageBookings.createWalkIn({
      venueCourtId: value.venueCourtId,
      timeSlotId: value.timeSlotId,
      customerName: value.customerName.trim(),
      customerPhone: value.customerPhone.trim()
    }).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.createLoading.set(false))
    ).subscribe({
      next: booking => {
        this.createOpen.set(false);
        this.notify.success('Đã tạo đơn walk-in. Hãy chọn cách thanh toán.');
        this.loadBookings(0);
        this.openPayment(booking);
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể tạo đơn walk-in.'))
    });
  }

  canCollectPayment(booking: OwnerBooking): boolean {
    return ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(booking.status)
      && booking.remainingAmount > 0
      && !this.isPaid(booking);
  }

  hasPendingOnlinePayment(booking: OwnerBooking): boolean {
    return booking.payments.some(payment =>
      payment.purpose === 'BOOKING_REMAINING'
      && (payment.status === 'CREATED' || payment.status === 'PENDING')
    );
  }

  openPayment(booking: OwnerBooking): void {
    this.stopPaymentPolling.next();
    this.paymentBooking.set(booking);
    this.checkoutQr.set(null);
    this.checkoutUrl.set(null);
    this.bookingTicketQr.set(null);
    this.paymentCompleted.set(this.isPaid(booking));
    if (booking.qrCode) {
      void toDataURL(booking.qrCode, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
        .then(image => {
          if (this.paymentBooking()?.bookingId === booking.bookingId) this.bookingTicketQr.set(image);
        })
        .catch(() => this.notify.error('Không thể hiển thị mã QR check-in.'));
    }
  }

  closePayment(): void {
    if (this.paymentLoading()) return;
    this.stopPaymentPolling.next();
    this.paymentBooking.set(null);
    this.checkoutQr.set(null);
    this.checkoutUrl.set(null);
    this.bookingTicketQr.set(null);
    this.paymentCompleted.set(false);
  }

  collectPayment(method: OwnerBookingPaymentMethod): void {
    const booking = this.paymentBooking();
    if (!booking || this.paymentLoading()) return;
    this.paymentLoading.set(method);
    this.manageBookings.createPayment(booking.bookingId, method).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.paymentLoading.set(null))
    ).subscribe({
      next: result => {
        if (result.status === 'SUCCEEDED') {
          this.finishPayment(booking.bookingId);
          this.notify.success('Đã ghi nhận thanh toán tiền mặt.');
          return;
        }
        if (!result.qrCodeContent) {
          this.notify.error('Payment-service không trả ảnh thanh toán payOS.');
          return;
        }
        this.checkoutQr.set(result.qrCodeContent);
        this.checkoutUrl.set(result.checkoutUrl ?? null);
        this.startPaymentPolling(booking.bookingId);
      },
      error: error => this.notify.error(this.errorMessage(error, 'Không thể khởi tạo thanh toán.'))
    });
  }

  private startPaymentPolling(bookingId: string): void {
    this.stopPaymentPolling.next();
    timer(1_500, 2_000).pipe(
      switchMap(() => this.manageBookings.detail(bookingId).pipe(catchError(() => of(null)))),
      filter((booking): booking is OwnerBooking => booking !== null),
      takeUntil(this.stopPaymentPolling),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(booking => {
      this.paymentBooking.set(booking);
      if (!this.isPaid(booking)) return;
      this.stopPaymentPolling.next();
      this.finishPayment(bookingId);
      this.notify.success('payOS đã xác nhận chuyển khoản thành công.');
    });
  }

  private finishPayment(bookingId: string): void {
    this.paymentCompleted.set(true);
    this.manageBookings.detail(bookingId).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: booking => this.paymentBooking.set(booking)
    });
    this.loadBookings(this.page());
  }

  private isPaid(booking: OwnerBooking): boolean {
    return !!booking.remainingPaymentId || booking.payments.some(payment =>
      payment.purpose === 'BOOKING_REMAINING' && payment.status === 'SUCCEEDED'
    );
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
  slotTotal(slot: OwnerTimeSlot | null): number {
    if (!slot) return 0;
    const [startHour, startMinute] = slot.startTime.split(':').map(Number);
    const [endHour, endMinute] = slot.endTime.split(':').map(Number);
    const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    return Math.round(slot.pricePerHour * minutes / 60);
  }

  private slotEndTimestamp(slot: OwnerTimeSlot): number {
    const [year, month, day] = slot.date.split('-').map(Number);
    const [hour, minute, second = 0] = slot.endTime.split(':').map(Number);
    if ([year, month, day, hour, minute, second].some(value => !Number.isFinite(value))) {
      return Number.NaN;
    }
    return new Date(year, month - 1, day, hour, minute, second).getTime();
  }

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

  today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
