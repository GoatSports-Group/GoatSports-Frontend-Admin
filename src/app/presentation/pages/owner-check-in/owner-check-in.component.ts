import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, take } from 'rxjs';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { toDataURL } from 'qrcode';
import { OwnerBooking, OwnerPayment } from '@application/dto/owner-booking/owner-booking.dto';
import {
  CheckInMethod,
  OwnerCheckInPage,
  OwnerCheckInResult
} from '@application/dto/owner-check-in/owner-check-in.dto';
import { OwnerTimeSlot } from '@application/dto/owner-schedule/owner-schedule.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { ManageOwnerCheckInUseCase } from '@application/usecase/owner-check-in/manage-owner-check-in.usecase';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

type WorkspaceTab = 'check-in' | 'walk-in' | 'history';
type LookupMode = 'bookingCode' | 'qrCode';

interface ResolvedCheckInScope {
  venueId: string;
  venueCourtId: string;
  venueName: string;
  courtName: string;
}

@Component({
  selector: 'app-owner-check-in',
  standalone: true,
  imports: [ReactiveFormsModule, LucideIconComponent, PaginationComponent, PageLoadingComponent],
  templateUrl: './owner-check-in.component.html',
  styleUrl: './owner-check-in.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerCheckInComponent implements OnDestroy {
  @ViewChild('scannerVideo') private scannerVideo?: ElementRef<HTMLVideoElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly getVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly manageSchedule = inject(ManageOwnerScheduleUseCase);
  private readonly manageCheckIn = inject(ManageOwnerCheckInUseCase);
  private readonly manageBookings = inject(ManageOwnerBookingsUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly requestedMode = this.route.snapshot.queryParamMap.get('mode') ?? '';
  private readonly qrReader = new BrowserQRCodeReader();
  private scannerControls?: IScannerControls;
  private scannerAutoStarted = false;

  readonly activeTab = signal<WorkspaceTab>('check-in');
  readonly lookupMode = signal<LookupMode>('bookingCode');
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly slots = signal<OwnerTimeSlot[]>([]);
  readonly history = signal<OwnerCheckInResult[]>([]);
  readonly selectedVenueId = signal('');
  readonly selectedCourtId = signal('');
  readonly resolvedScope = signal<ResolvedCheckInScope | null>(null);
  readonly historyDate = signal(this.today());
  readonly historyPage = signal(0);
  readonly historyPages = signal(0);
  readonly historyTotal = signal(0);
  readonly historyPageSize = 10;
  readonly reconciliation = signal<OwnerCheckInResult | null>(null);
  readonly reconciliationMethod = signal<CheckInMethod>('BOOKING_CODE');
  readonly loadingContext = signal(true);
  readonly loadingCourt = signal(false);
  readonly historyLoading = signal(false);
  readonly lookingUp = signal(false);
  readonly confirming = signal(false);
  readonly creatingWalkIn = signal(false);
  readonly scannerActive = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly scheduleError = signal<string | null>(null);
  readonly historyError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly detailBooking = signal<OwnerBooking | null>(null);
  readonly detailBookingQr = signal<string | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly requestedBookingId = signal<string | null>(null);

  readonly availableSlots = computed(() => this.slots().filter(slot => slot.status === 'AVAILABLE'));
  readonly availableSlotPreview = computed(() => this.availableSlots().slice(0, 4));
  readonly lookupForm = this.formBuilder.nonNullable.group({
    value: ['', [Validators.required, Validators.maxLength(500)]]
  });
  readonly walkInForm = this.formBuilder.nonNullable.group({
    timeSlotId: ['', Validators.required],
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    customerPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 .-]{8,20}$/)]]
  });

  constructor() {
    if (this.requestedMode === 'qr') this.lookupMode.set('qrCode');
    this.loadContext();
  }

  ngOnDestroy(): void { this.stopScanner(); }

  setTab(tab: WorkspaceTab): void {
    this.activeTab.set(tab);
    this.actionError.set(null);
    if (tab !== 'check-in') this.stopScanner();
    if (tab === 'history') this.loadHistory();
  }

  setLookupMode(mode: LookupMode): void {
    this.stopScanner();
    this.lookupMode.set(mode);
    this.lookupForm.reset({ value: '' });
    this.clearResolvedLookup();
    this.actionError.set(null);
  }

  loadContext(): void {
    this.loadingContext.set(true);
    this.loadError.set(null);
    this.getVenues.execute().pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingContext.set(false))
    ).subscribe({
      next: venues => {
        this.venues.set(venues);
        if (this.requestedMode === 'qr' && !this.scannerAutoStarted) {
          this.scannerAutoStarted = true;
          setTimeout(() => void this.startScanner());
        }
      },
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải phạm vi cơ sở của bạn.'))
    });
  }

  loadCourtData(): void {
    const courtId = this.selectedCourtId();
    if (!courtId) {
      this.slots.set([]);
      return;
    }
    this.loadingCourt.set(true);
    this.scheduleError.set(null);
    this.manageSchedule.listSlots(courtId, this.today(), this.today()).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingCourt.set(false))
    ).subscribe({
      next: slots => this.slots.set(slots),
      error: error => this.scheduleError.set(this.errorMessage(error, 'Không thể tải lịch của sân vừa tra cứu.'))
    });
  }

  lookup(): void {
    if (this.lookingUp() || this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }
    const value = this.lookupForm.getRawValue().value.trim();
    const request = this.lookupMode() === 'qrCode' ? { qrCode: value } : { bookingCode: value };
    this.clearResolvedLookup();
    this.lookingUp.set(true);
    this.actionError.set(null);
    this.manageCheckIn.lookup(request).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.lookingUp.set(false))
    ).subscribe({
      next: result => {
        this.reconciliation.set(result);
        this.reconciliationMethod.set(this.lookupMode() === 'qrCode' ? 'QR_CODE' : 'BOOKING_CODE');
        this.applyResolvedScope(result.booking);
        this.stopScanner();
      },
      error: error => {
        this.reconciliation.set(null);
        this.actionError.set(this.errorMessage(error, 'Không thể đối chiếu đơn đặt sân.'));
      }
    });
  }

  confirm(): void {
    const result = this.reconciliation();
    if (!result || result.checkInEligible === false || this.confirming()) return;
    this.confirming.set(true);
    this.actionError.set(null);
    const method = this.reconciliationMethod();
    const evidence = this.lookupForm.getRawValue().value.trim();
    const checkInRequest = {
      bookingId: result.booking.bookingId,
      method,
      paymentMode: 'NONE' as const,
      qrCode: method === 'QR_CODE' ? evidence : undefined,
      bookingCode: method === 'BOOKING_CODE' ? evidence : undefined
    };
    this.manageCheckIn.confirm(checkInRequest).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.confirming.set(false))
    ).subscribe({
      next: checkedIn => {
        this.reconciliation.set(checkedIn);
        this.notify.success('Nhận sân thành công.');
        this.loadCourtData();
        this.loadHistory(0);
      },
      error: error => this.actionError.set(this.errorMessage(error, 'Không thể xác nhận nhận sân.'))
    });
  }

  createWalkIn(): void {
    const courtId = this.selectedCourtId();
    if (!courtId || this.creatingWalkIn() || this.walkInForm.invalid) {
      this.walkInForm.markAllAsTouched();
      return;
    }
    this.creatingWalkIn.set(true);
    this.actionError.set(null);
    const value = this.walkInForm.getRawValue();
    this.manageCheckIn.createWalkIn({
      venueCourtId: courtId,
      timeSlotId: value.timeSlotId,
      customerName: value.customerName.trim(),
      customerPhone: value.customerPhone.trim()
    }).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingWalkIn.set(false))
    ).subscribe({
      next: result => {
        this.walkInForm.reset({ timeSlotId: '', customerName: '', customerPhone: '' });
        this.notify.success(`Đã tạo đơn ${result.booking.bookingCode} và phát hành mã QR nhận sân.`);
        this.loadCourtData();
      },
      error: error => this.actionError.set(this.errorMessage(error, 'Không thể xếp lịch cho khách tại quầy.'))
    });
  }

  loadHistory(page = this.historyPage()): void {
    this.historyPage.set(page);
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.manageCheckIn.history(this.historyFilter()).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.historyLoading.set(false))
    ).subscribe({
      next: result => this.applyHistory(result),
      error: error => this.historyError.set(this.errorMessage(error, 'Không thể tải lịch sử nhận sân.'))
    });
  }

  async startScanner(): Promise<void> {
    if (this.scannerActive() || !navigator.mediaDevices?.getUserMedia) {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.actionError.set('Thiết bị không hỗ trợ máy quay. Hãy dùng mã đặt sân trên vé điện tử.');
      }
      return;
    }
    this.actionError.set(null);
    this.scannerActive.set(true);
    try {
      await new Promise(resolve => setTimeout(resolve));
      const video = this.scannerVideo?.nativeElement;
      if (!video) throw new Error('CAMERA_VIEW_UNAVAILABLE');
      const controls = await this.qrReader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result, _error, scannerControls) => {
          if (!result || this.lookingUp()) return;
          scannerControls.stop();
          this.scannerControls = undefined;
          this.scannerActive.set(false);
          this.lookupForm.controls.value.setValue(result.getText());
          this.lookup();
        }
      );
      if (!this.scannerActive()) {
        controls.stop();
        return;
      }
      this.scannerControls = controls;
    } catch (error) {
      this.stopScanner();
      this.actionError.set(this.cameraErrorMessage(error));
    }
  }

  stopScanner(): void {
    this.scannerControls?.stop();
    this.scannerControls = undefined;
    const stream = this.scannerVideo?.nativeElement.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());
    this.scannerActive.set(false);
  }

  closeReconciliation(): void {
    if (this.confirming()) return;
    this.reconciliation.set(null);
    this.actionError.set(null);
  }

  openHistoryDetail(bookingId: string): void {
    if (this.detailLoading() && this.requestedBookingId() === bookingId) return;
    this.requestedBookingId.set(bookingId);
    this.detailBooking.set(null);
    this.detailBookingQr.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.manageBookings.detail(bookingId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (this.requestedBookingId() === bookingId) this.detailLoading.set(false);
      })
    ).subscribe({
      next: booking => {
        if (this.requestedBookingId() !== bookingId) return;
        this.detailBooking.set(booking);
        if (!booking.qrCode) return;
        void toDataURL(booking.qrCode, { width: 180, margin: 1, errorCorrectionLevel: 'M' })
          .then(image => {
            if (this.requestedBookingId() === bookingId) this.detailBookingQr.set(image);
          })
          .catch(() => this.notify.error('Không thể hiển thị mã QR nhận sân.'));
      },
      error: error => {
        if (this.requestedBookingId() === bookingId) {
          this.detailError.set(this.errorMessage(error, 'Không thể tải chi tiết đơn đặt sân.'));
        }
      }
    });
  }

  retryHistoryDetail(): void {
    const bookingId = this.requestedBookingId();
    if (bookingId) this.openHistoryDetail(bookingId);
  }

  closeHistoryDetail(): void {
    this.requestedBookingId.set(null);
    this.detailBooking.set(null);
    this.detailBookingQr.set(null);
    this.detailError.set(null);
    this.detailLoading.set(false);
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  time(value: string): string { return value?.slice(0, 5) ?? '--:--'; }

  statusLabel(status: OwnerBooking['status']): string {
    return {
      PENDING_PAYMENT: 'Chờ thanh toán',
      CONFIRMED: 'Đã xác nhận',
      CHECKED_IN: 'Đã nhận sân',
      COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
      REFUND_PENDING: 'Chờ hoàn tiền',
      REFUNDED: 'Đã hoàn tiền',
      EXPIRED: 'Hết hạn'
    }[status];
  }

  sourceLabel(source: OwnerBooking['source']): string {
    return source === 'WALK_IN' ? 'Khách tại quầy' : source === 'DIRECT' ? 'Đặt trực tuyến' : 'Ghép trận';
  }

  sourceIcon(source: OwnerBooking['source']): string {
    return source === 'WALK_IN' ? 'store' : source === 'DIRECT' ? 'globe' : 'user-plus';
  }

  customerName(booking: OwnerBooking): string {
    return booking.walkInCustomerName?.trim() || `Khách #${booking.playerId?.slice(0, 8).toUpperCase() || 'LẺ'}`;
  }

  customerPhone(booking: OwnerBooking): string {
    return booking.walkInCustomerPhone?.trim() || '—';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
  }

  formatDateTime(value?: string): string {
    return value
      ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
      : '—';
  }

  formatTimelineDateTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = (part: number) => part.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  displayPayment(booking: OwnerBooking): OwnerPayment | undefined {
    return [...booking.payments].sort((left, right) =>
      new Date(right.paidAt || right.createdAt).getTime() - new Date(left.paidAt || left.createdAt).getTime()
    )[0];
  }

  paymentMethodLabel(payment: OwnerPayment): string {
    if (payment.method === 'CASH' || payment.providerTransactionId?.toUpperCase().startsWith('CASH-')) return 'Tiền mặt';
    if (payment.method === 'BANK_TRANSFER' || payment.provider === 'PAYOS' || payment.providerTransactionId) {
      return 'Ví điện tử (PayOS)';
    }
    return '—';
  }

  paymentStateLabel(booking: OwnerBooking): string {
    const paid = booking.payments.filter(payment => payment.status === 'SUCCEEDED')
      .reduce((total, payment) => total + Math.max(0, payment.amount || 0), 0);
    if (paid + 0.01 >= booking.totalPrice || booking.remainingPaymentId) return 'Đã thanh toán đủ';
    if (paid > 0 || booking.depositPaymentId) return 'Chưa thanh toán đủ';
    return 'Chưa thanh toán';
  }

  paymentTimelineLabel(payment: OwnerPayment): string {
    const label = payment.purpose === 'BOOKING_DEPOSIT' ? 'Thanh toán tiền cọc' : 'Thanh toán còn lại';
    return payment.status === 'SUCCEEDED' ? label : `${label} – chưa thành công`;
  }

  paymentDateTime(payment?: OwnerPayment): string {
    return this.formatDateTime(payment?.paidAt);
  }

  paymentStatusLabel(status: string): string {
    return {
      SUCCEEDED: 'Thành công',
      CREATED: 'Mới tạo',
      PENDING: 'Đang chờ',
      FAILED: 'Thất bại',
      EXPIRED: 'Hết hạn',
      CANCELLED: 'Đã hủy',
      REFUNDED: 'Đã hoàn tiền'
    }[status] ?? 'Chưa xác định';
  }

  checkInMethodLabel(method?: CheckInMethod): string {
    if (method === 'QR_CODE') return 'Mã QR';
    if (method === 'BOOKING_CODE') return 'Mã đặt sân';
    if (method === 'MANUAL') return 'Xác nhận thủ công';
    return '—';
  }

  private historyFilter() {
    return {
      date: this.historyDate() || undefined,
      page: this.historyPage(),
      size: 10
    };
  }

  private applyResolvedScope(booking: OwnerBooking): void {
    this.selectedVenueId.set(booking.venueId);
    this.selectedCourtId.set(booking.venueCourtId);
    this.resolvedScope.set({
      venueId: booking.venueId,
      venueCourtId: booking.venueCourtId,
      venueName: booking.venueName,
      courtName: booking.courtName
    });
    this.walkInForm.controls.timeSlotId.setValue('');
    this.loadCourtData();
  }

  private clearResolvedLookup(): void {
    this.reconciliation.set(null);
    this.resolvedScope.set(null);
    this.selectedVenueId.set('');
    this.selectedCourtId.set('');
    this.slots.set([]);
    this.scheduleError.set(null);
  }

  private applyHistory(result: OwnerCheckInPage): void {
    this.history.set(result.items);
    this.historyPage.set(result.page);
    this.historyPages.set(result.pages);
    this.historyTotal.set(result.total);
  }

  private cameraErrorMessage(error: unknown): string {
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError') return 'Máy quay đã bị từ chối quyền truy cập. Hãy cấp quyền rồi thử lại.';
    if (name === 'NotFoundError') return 'Không tìm thấy máy quay trên thiết bị này.';
    if (name === 'NotReadableError') return 'Máy quay đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
    return 'Không thể mở máy quay. Hãy dùng kết nối an toàn, cấp quyền truy cập rồi thử lại.';
  }

  private busy(): boolean {
    return this.loadingCourt() || this.lookingUp() || this.confirming() || this.creatingWalkIn();
  }

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message || candidate?.message || fallback;
  }
}
