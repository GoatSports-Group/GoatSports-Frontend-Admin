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
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { CheckInMethod, OwnerCheckInResult } from '@application/dto/owner-check-in/owner-check-in.dto';
import { OwnerTimeSlot } from '@application/dto/owner-schedule/owner-schedule.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerCheckInUseCase } from '@application/usecase/owner-check-in/manage-owner-check-in.usecase';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

type WorkspaceTab = 'check-in' | 'walk-in' | 'history';
type LookupMode = 'bookingCode' | 'qrCode';

interface BarcodeResult { rawValue: string; }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<BarcodeResult[]>; }
interface BarcodeDetectorConstructor { new(options: { formats: string[] }): BarcodeDetectorLike; }
interface ResolvedCheckInScope {
  venueId: string;
  venueCourtId: string;
  venueName: string;
  courtName: string;
}

@Component({
  selector: 'app-owner-check-in',
  standalone: true,
  imports: [ReactiveFormsModule, LucideIconComponent, PageLoadingComponent],
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
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly requestedMode = this.route.snapshot.queryParamMap.get('mode') ?? '';
  private mediaStream?: MediaStream;
  private scannerFrame?: number;
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
  readonly reconciliation = signal<OwnerCheckInResult | null>(null);
  readonly reconciliationMethod = signal<CheckInMethod>('BOOKING_CODE');
  readonly loadingContext = signal(true);
  readonly loadingCourt = signal(false);
  readonly lookingUp = signal(false);
  readonly confirming = signal(false);
  readonly creatingWalkIn = signal(false);
  readonly scannerActive = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly scheduleError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

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
        this.actionError.set(this.errorMessage(error, 'Không thể đối soát booking.'));
      }
    });
  }

  confirm(): void {
    const result = this.reconciliation();
    if (!result || this.confirming()) return;
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
        this.notify.success('Check-in thành công.');
        this.loadCourtData();
      },
      error: error => this.actionError.set(this.errorMessage(error, 'Không thể xác nhận check-in.'))
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
        this.notify.success(`Đã tạo booking ${result.booking.bookingCode} và phát hành mã QR check-in.`);
        this.loadCourtData();
      },
      error: error => this.actionError.set(this.errorMessage(error, 'Không thể xếp lịch walk-in.'))
    });
  }

  loadHistory(page = this.historyPage()): void {
    this.historyPage.set(page);
    this.loadingCourt.set(true);
    this.manageCheckIn.history(this.historyFilter()).pipe(
      take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingCourt.set(false))
    ).subscribe({
      next: result => this.applyHistory(result),
      error: error => this.loadError.set(this.errorMessage(error, 'Không thể tải lịch sử check-in.'))
    });
  }

  async startScanner(): Promise<void> {
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      this.actionError.set('Trình duyệt không hỗ trợ quét QR. Hãy dán mã QR hoặc dùng Booking Code.');
      return;
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.scannerActive.set(true);
      setTimeout(() => {
        const video = this.scannerVideo?.nativeElement;
        if (!video || !this.mediaStream) return;
        video.srcObject = this.mediaStream;
        void video.play();
        this.scanFrame(new Detector({ formats: ['qr_code'] }), video);
      });
    } catch {
      this.actionError.set('Không thể mở camera. Hãy cấp quyền hoặc dùng Booking Code.');
    }
  }

  stopScanner(): void {
    if (this.scannerFrame) cancelAnimationFrame(this.scannerFrame);
    this.scannerFrame = undefined;
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = undefined;
    this.scannerActive.set(false);
  }

  closeReconciliation(): void {
    if (this.confirming()) return;
    this.reconciliation.set(null);
    this.actionError.set(null);
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  time(value: string): string { return value?.slice(0, 5) ?? '--:--'; }

  private scanFrame(detector: BarcodeDetectorLike, video: HTMLVideoElement): void {
    if (!this.scannerActive()) return;
    detector.detect(video).then(results => {
      const value = results[0]?.rawValue;
      if (value) {
        this.lookupForm.controls.value.setValue(value);
        this.lookup();
        return;
      }
      this.scannerFrame = requestAnimationFrame(() => this.scanFrame(detector, video));
    }).catch(() => {
      this.actionError.set('Không đọc được khung hình QR. Hãy thử Booking Code.');
      this.stopScanner();
    });
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

  private applyHistory(result: { items: OwnerCheckInResult[]; page: number; pages: number }): void {
    this.history.set(result.items);
    this.historyPage.set(result.page);
    this.historyPages.set(result.pages);
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
