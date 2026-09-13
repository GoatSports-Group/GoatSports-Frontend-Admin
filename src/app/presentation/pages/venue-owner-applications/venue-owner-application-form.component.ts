import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
  inject,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';
import { BusinessType } from '@application/dto/owner-application/owner-application.dto';
import {
  OwnerApplicationFiles,
  OwnerFaceReadiness,
  PreparedOwnerIdentity
} from '@application/ports/persistence/owner-application.repository';
import { AnalyzeOwnerFaceReadinessUseCase } from '@application/usecase/owner-application/analyze-owner-face-readiness.usecase';
import { SearchAddressSuggestionsUseCase } from '@application/usecase/owner-application/search-address-suggestions.usecase';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { VerifyOwnerIdentityUseCase } from '@application/usecase/owner-application/verify-owner-identity.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import {
  Subject,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  map,
  of,
  switchMap
} from 'rxjs';
import { VenueOwnerSubmissionLoaderComponent } from './venue-owner-submission-loader.component';

type FileKey = keyof OwnerApplicationFiles;
type ApplicationForm = {
  fullName: string;
  phone: string;
  email: string;
  identityNumber: string;
  businessName: string;
  businessType: BusinessType;
  taxCode: string;
  address: string;
  ward: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
};

@Component({
  selector: 'app-venue-owner-application-form',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, LucideIconComponent],
  templateUrl: './venue-owner-application-form.component.html',
  styleUrl: './venue-owner-application-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerApplicationFormComponent implements OnDestroy {
  private readonly submitApplication = inject(SubmitOwnerApplicationUseCase);
  private readonly verifyIdentity = inject(VerifyOwnerIdentityUseCase);
  private readonly analyzeFaceReadiness = inject(AnalyzeOwnerFaceReadinessUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly searchAddressSuggestions = inject(SearchAddressSuggestionsUseCase);
  private readonly addressInput = new Subject<string>();
  private submissionOverlayRef: OverlayRef | null = null;
  private selectedAddressValue = '';
  private cameraStream: MediaStream | null = null;
  private captureResolve: ((frames: string[]) => void) | null = null;
  private captureReject: ((reason: unknown) => void) | null = null;
  private faceMonitorGeneration = 0;
  private previousFaceSample: OwnerFaceReadiness | null = null;
  private stableSampleCount = 0;
  private readonly capturedLivenessFrames: string[] = [];

  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;

  readonly submitted = output<void>();
  readonly cancelled = output<void>();
  readonly currentStep = signal(1);
  readonly furthestStep = signal(1);
  readonly submitting = signal(false);
  readonly verifying = signal(false);
  readonly cameraActive = signal(false);
  readonly cameraReady = signal(false);
  readonly faceScanning = signal(false);
  readonly scanProgress = signal(0);
  readonly faceReadiness = signal<OwnerFaceReadiness | null>(null);
  readonly faceStable = signal(false);
  readonly faceStatus = signal('Đang khởi động camera...');
  readonly preparedIdentity = signal<PreparedOwnerIdentity | null>(null);
  readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  readonly addressSearchLoading = signal(false);
  readonly addressDetailLoading = signal(false);
  readonly addressSuggestionsOpen = signal(false);
  readonly addressSearchError = signal('');
  readonly activeSuggestionIndex = signal(-1);
  readonly steps = ['Hồ sơ pháp lý', 'Người đại diện', 'Thông tin cơ sở', 'Địa chỉ sân'];
  readonly stepDescriptions = [
    'Tải giấy tờ và xác minh danh tính',
    'Thông tin liên hệ của người đại diện',
    'Tên cơ sở, loại hình và quy mô',
    'Vị trí và thông tin địa chỉ'
  ];
  readonly panelDescriptions = [
    'Tải hai ảnh CCCD, một giấy phép PDF và một ảnh sân; mỗi file tối đa 2 MB.',
    'Họ tên và số CCCD được tự động điền từ kết quả xác minh; bạn chỉ cần bổ sung thông tin liên hệ.',
    'Cung cấp thông tin kinh doanh để GoatSports kiểm tra hồ sơ cơ sở.',
    'Chọn địa chỉ chính xác để người chơi có thể tìm thấy sân của bạn.'
  ];
  readonly fileLabels: Record<FileKey, string> = {
    idCardFront: 'CCCD mặt trước',
    idCardBack: 'CCCD mặt sau',
    businessLicense: 'Giấy phép kinh doanh',
    venueImage: 'Hình ảnh cơ sở / sân'
  };
  readonly fileHints: Record<FileKey, string> = {
    idCardFront: 'JPG, PNG hoặc WebP · tối đa 2 MB',
    idCardBack: 'JPG, PNG hoặc WebP · tối đa 2 MB',
    businessLicense: 'Chỉ nhận file PDF · tối đa 2 MB',
    venueImage: 'Một ảnh JPG, PNG hoặc WebP · tối đa 2 MB'
  };
  readonly fileAccepts: Record<FileKey, string> = {
    idCardFront: 'image/jpeg,image/png,image/webp',
    idCardBack: 'image/jpeg,image/png,image/webp',
    businessLicense: 'application/pdf',
    venueImage: 'image/jpeg,image/png,image/webp'
  };
  readonly fileKeys: FileKey[] = ['idCardFront', 'idCardBack', 'businessLicense', 'venueImage'];

  form: ApplicationForm = this.emptyForm();
  files: Record<FileKey, File | null> = this.emptyFiles();

  constructor() {
    this.addressInput.pipe(
      map(value => value.trim()),
      debounceTime(450),
      distinctUntilChanged(),
      switchMap(query => {
        this.addressSearchError.set('');
        if (query.length < 3) return of([]);

        return defer(() => {
          this.addressSearchLoading.set(true);
          return this.searchAddressSuggestions.execute(query).pipe(
            catchError(() => {
              this.addressSearchError.set('Không thể tải gợi ý. Bạn vẫn có thể nhập địa chỉ thủ công.');
              return of([]);
            }),
            finalize(() => this.addressSearchLoading.set(false))
          );
        });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(suggestions => {
      this.addressSuggestions.set(suggestions);
      this.activeSuggestionIndex.set(suggestions.length ? 0 : -1);
      this.addressSuggestionsOpen.set(Boolean(suggestions.length || this.addressSearchError()));
    });
  }

  goToStep(step: number): void {
    if (!this.isBusy() && step >= 1 && step <= this.furthestStep()) {
      this.currentStep.set(step);
    }
  }

  nextStep(): void {
    const step = this.currentStep();
    if (this.isBusy() || !this.validateStep(step)) return;
    if (step === 1 && !this.preparedIdentity()) {
      void this.verifyDocumentsAndIdentity();
      return;
    }
    this.moveToStep(Math.min(4, step + 1));
  }

  previousStep(): void {
    if (!this.isBusy()) this.currentStep.update(step => Math.max(1, step - 1));
  }

  cancel(): void {
    if (!this.isBusy()) this.cancelled.emit();
  }

  onAddressInput(value: string): void {
    if (value !== this.selectedAddressValue) {
      this.form.latitude = null;
      this.form.longitude = null;
      this.selectedAddressValue = '';
    }
    this.activeSuggestionIndex.set(-1);
    this.addressInput.next(value);
  }

  openAddressSuggestions(): void {
    if (this.addressSuggestions().length || this.addressSearchError()) {
      this.addressSuggestionsOpen.set(true);
    }
  }

  closeAddressSuggestions(): void {
    this.addressSuggestionsOpen.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  handleAddressKeydown(event: KeyboardEvent): void {
    const suggestions = this.addressSuggestions();
    if (event.key === 'Escape') {
      this.closeAddressSuggestions();
      return;
    }
    if (!this.addressSuggestionsOpen() || suggestions.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.activeSuggestionIndex.set(
        (this.activeSuggestionIndex() + direction + suggestions.length) % suggestions.length
      );
      return;
    }

    if (event.key === 'Enter') {
      const selected = suggestions[this.activeSuggestionIndex()];
      if (!selected) return;
      event.preventDefault();
      event.stopPropagation();
      this.selectAddressSuggestion(selected);
    }
  }

  selectAddressSuggestion(suggestion: AddressSuggestion): void {
    if (this.addressDetailLoading()) return;
    this.closeAddressSuggestions();
    this.addressDetailLoading.set(true);
    this.searchAddressSuggestions.resolve(suggestion).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.addressDetailLoading.set(false))
    ).subscribe({
      next: resolved => {
        if (resolved.latitude === null || resolved.longitude === null) {
          this.addressSearchError.set('Dịch vụ địa chỉ không trả về tọa độ. Vui lòng chọn địa chỉ khác.');
          this.addressSuggestionsOpen.set(true);
          return;
        }
        this.form.address = resolved.address || resolved.formattedAddress;
        this.form.ward = resolved.ward;
        this.form.district = resolved.district;
        this.form.city = resolved.city;
        this.form.latitude = resolved.latitude;
        this.form.longitude = resolved.longitude;
        this.selectedAddressValue = this.form.address;
        this.addressSuggestions.set([]);
        this.addressSearchError.set('');
      },
      error: () => {
        this.addressSearchError.set('Không thể lấy chi tiết địa chỉ. Vui lòng thử lại.');
        this.addressSuggestionsOpen.set(true);
      }
    });
  }

  selectFile(key: FileKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.notify.warning(`${this.fileLabels[key]} không được vượt quá 2MB.`);
      input.value = '';
      return;
    }
    const allowedTypes = key === 'businessLicense'
      ? ['application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.notify.warning(key === 'businessLicense'
        ? 'Giấy phép kinh doanh chỉ nhận file PDF.'
        : `${this.fileLabels[key]} chỉ nhận ảnh JPG, PNG hoặc WebP.`);
      input.value = '';
      return;
    }
    this.files = { ...this.files, [key]: file };
    this.preparedIdentity.set(null);
    this.furthestStep.set(1);
  }

  removeFile(key: FileKey): void {
    if (this.isBusy()) return;
    this.files = { ...this.files, [key]: null };
    this.preparedIdentity.set(null);
    this.furthestStep.set(1);
  }

  submit(): void {
    const preparedIdentity = this.preparedIdentity();
    if (this.isBusy() || !preparedIdentity || !this.validateAll()) {
      if (!preparedIdentity) this.notify.warning('Vui lòng xác minh CCCD và khuôn mặt trước khi gửi đơn.');
      return;
    }

    this.submitting.set(true);
    this.showSubmissionLoader();
    const normalizedForm = Object.fromEntries(Object.entries(this.form).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value
    ]));
    const submissionForm = { ...normalizedForm, province: normalizedForm['city'] };

    defer(() => this.submitApplication.execute(submissionForm, preparedIdentity)).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.submitting.set(false);
        this.hideSubmissionLoader();
      })
    ).subscribe({
      next: () => {
        this.resetForm();
        this.notify.success('Đã nộp đơn đăng ký chủ sân thành công.');
        this.submitted.emit();
      },
      error: error => this.notify.error(this.errorMessage(error, 'Đã xảy ra lỗi khi gửi đơn đăng ký.'))
    });
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const target = keyboardEvent.target as HTMLElement | null;
    const ignoredTags = ['TEXTAREA', 'BUTTON', 'SELECT'];
    if (
      this.isBusy()
      || keyboardEvent.repeat
      || target?.isContentEditable
      || (target && ignoredTags.includes(target.tagName))
    ) return;

    keyboardEvent.preventDefault();
    this.currentStep() < 4 ? this.nextStep() : this.submit();
  }

  @HostListener('window:beforeunload', ['$event'])
  preventLeavingWhileBusy(event: BeforeUnloadEvent): void {
    if (!this.isBusy()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  ngOnDestroy(): void {
    this.cancelFaceScan();
    this.stopCamera();
    this.hideSubmissionLoader();
  }

  private async monitorFaceReadiness(generation: number): Promise<void> {
    const video = this.cameraVideo?.nativeElement;
    if (!video?.videoWidth || !video.videoHeight) {
      this.failFaceScan(new Error('Camera chưa sẵn sàng. Vui lòng thử lại.'));
      return;
    }

    while (this.cameraActive() && generation === this.faceMonitorGeneration) {
      try {
        this.ensureCameraActive();
        const frame = this.captureCameraFrame(video);
        const readiness = await firstValueFrom(this.analyzeFaceReadiness.execute(frame));
        if (!this.cameraActive() || generation !== this.faceMonitorGeneration) return;
        this.faceReadiness.set(readiness);

        if (!readiness.ready) {
          this.resetRealtimeCapture(readiness.message);
          await this.delay(220);
          continue;
        }

        const stable = this.isFaceStable(readiness);
        this.previousFaceSample = readiness;
        this.faceStable.set(stable);
        if (!stable) {
          this.resetRealtimeCapture('Giữ đầu và khuôn mặt đứng yên.');
          this.previousFaceSample = readiness;
          await this.delay(220);
          continue;
        }

        this.stableSampleCount += 1;
        if (this.stableSampleCount < 3) {
          this.faceStatus.set('Đúng tư thế, tiếp tục giữ yên...');
          await this.delay(220);
          continue;
        }

        this.faceScanning.set(true);
        this.capturedLivenessFrames.push(frame);
        this.scanProgress.set(this.capturedLivenessFrames.length * 20);
        this.faceStatus.set(`Đang tự động quét khuôn mặt ${this.scanProgress()}%`);
        if (this.capturedLivenessFrames.length >= 5) {
          const resolve = this.captureResolve;
          const frames = [...this.capturedLivenessFrames];
          this.clearCaptureCallbacks();
          this.stopCamera();
          resolve?.(frames);
          return;
        }
        await this.delay(220);
      } catch {
        if (!this.cameraActive() || generation !== this.faceMonitorGeneration) return;
        this.resetRealtimeCapture('Không thể phân tích camera realtime. Đang thử kết nối lại...');
        await this.delay(900);
      }
    }
  }

  cancelFaceScan(): void {
    if (!this.cameraActive()) return;
    const reject = this.captureReject;
    this.clearCaptureCallbacks();
    this.stopCamera();
    reject?.(new DOMException('Đã hủy xác minh khuôn mặt.', 'AbortError'));
  }

  private async verifyDocumentsAndIdentity(): Promise<void> {
    if (this.verifying()) return;
    this.verifying.set(true);
    try {
      const livenessFrames = await this.captureLivenessFrames();
      this.showSubmissionLoader('verification');
      this.verifyIdentity.execute({
        idCardFront: this.files.idCardFront!,
        idCardBack: this.files.idCardBack!,
        businessLicense: this.files.businessLicense!,
        venueImage: this.files.venueImage!
      }, livenessFrames).pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.verifying.set(false);
          this.hideSubmissionLoader();
        })
      ).subscribe({
        next: prepared => {
          this.preparedIdentity.set(prepared);
          this.form.fullName = prepared.fullName;
          this.form.identityNumber = prepared.identityNumber;
          this.moveToStep(2);
          this.notify.success('Xác minh CCCD và khuôn mặt thành công.');
        },
        error: error => this.notify.error(this.errorMessage(error, 'Không thể xác minh CCCD và khuôn mặt.'))
      });
    } catch (error) {
      this.verifying.set(false);
      this.hideSubmissionLoader();
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.notify.error(this.errorMessage(error, 'Không thể sử dụng camera để xác minh.'));
      }
    }
  }

  private captureLivenessFrames(): Promise<string[]> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return Promise.reject(new Error('Trình duyệt không hỗ trợ camera. Vui lòng dùng Chrome hoặc Edge mới nhất.'));
    }

    this.cameraActive.set(true);
    this.cameraReady.set(false);
    this.faceScanning.set(false);
    this.scanProgress.set(0);
    this.faceReadiness.set(null);
    this.faceStable.set(false);
    this.faceStatus.set('Đang khởi động camera...');
    this.previousFaceSample = null;
    this.stableSampleCount = 0;
    this.capturedLivenessFrames.length = 0;

    return new Promise<string[]>((resolve, reject) => {
      this.captureResolve = resolve;
      this.captureReject = reject;
      requestAnimationFrame(() => void this.initializeCamera());
    });
  }

  private async initializeCamera(): Promise<void> {
    const video = this.cameraVideo?.nativeElement;
    if (!video) {
      this.failFaceScan(new Error('Không thể khởi tạo màn hình camera.'));
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = this.cameraStream;
      await video.play();
      if (!video.videoWidth) {
        await new Promise<void>(resolve => video.addEventListener('loadedmetadata', () => resolve(), { once: true }));
      }
      await this.delay(500);
      this.cameraReady.set(true);
      this.faceStatus.set('Đưa khuôn mặt vào giữa khung và nhìn thẳng vào camera.');
      const generation = ++this.faceMonitorGeneration;
      void this.monitorFaceReadiness(generation);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.failFaceScan(new Error('Bạn cần cho phép truy cập camera để xác minh khuôn mặt.'));
        return;
      }
      this.failFaceScan(error);
    }
  }

  private stopCamera(): void {
    this.faceMonitorGeneration += 1;
    this.cameraStream?.getTracks().forEach(track => track.stop());
    this.cameraStream = null;
    if (this.cameraVideo?.nativeElement) this.cameraVideo.nativeElement.srcObject = null;
    this.cameraActive.set(false);
    this.cameraReady.set(false);
    this.faceScanning.set(false);
    this.scanProgress.set(0);
    this.faceReadiness.set(null);
    this.faceStable.set(false);
    this.previousFaceSample = null;
    this.stableSampleCount = 0;
    this.capturedLivenessFrames.length = 0;
  }

  private failFaceScan(error: unknown): void {
    const reject = this.captureReject;
    this.clearCaptureCallbacks();
    this.stopCamera();
    reject?.(error);
  }

  private clearCaptureCallbacks(): void {
    this.captureResolve = null;
    this.captureReject = null;
  }

  private ensureCameraActive(): void {
    if (!this.cameraActive() || !this.cameraStream) {
      throw new DOMException('Đã hủy xác minh khuôn mặt.', 'AbortError');
    }
  }

  private captureCameraFrame(video: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = Math.max(360, Math.round(480 * video.videoHeight / video.videoWidth));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không thể đọc hình ảnh từ camera.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.76);
  }

  private isFaceStable(current: OwnerFaceReadiness): boolean {
    const previous = this.previousFaceSample;
    if (!previous?.faceBox || !current.faceBox) return false;
    const [x, y, width, height] = current.faceBox;
    const [previousX, previousY, previousWidth, previousHeight] = previous.faceBox;
    const centerMovement = Math.hypot(
      x + width / 2 - (previousX + previousWidth / 2),
      y + height / 2 - (previousY + previousHeight / 2)
    );
    return centerMovement <= 0.022
      && Math.abs(width - previousWidth) <= 0.035
      && Math.abs(height - previousHeight) <= 0.045
      && Math.abs(current.yawRatio - previous.yawRatio) <= 0.08
      && Math.abs(current.pitchRatio - previous.pitchRatio) <= 0.10
      && Math.abs(current.rollDegrees - previous.rollDegrees) <= 4;
  }

  private resetRealtimeCapture(message: string): void {
    this.faceScanning.set(false);
    this.faceStable.set(false);
    this.faceStatus.set(message);
    this.scanProgress.set(0);
    this.stableSampleCount = 0;
    this.capturedLivenessFrames.length = 0;
    if (!this.faceReadiness()?.ready) this.previousFaceSample = null;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  private validateAll(): boolean {
    for (let step = 1; step <= 4; step += 1) {
      if (!this.validateStep(step, false)) {
        this.currentStep.set(step);
        return this.validateStep(step, true);
      }
    }
    return true;
  }

  private validateStep(step: number, notify = true): boolean {
    let message = '';
    if (step === 1) {
      const missing = this.fileKeys.find(key => !this.files[key]);
      if (missing) message = `Vui lòng tải lên ${this.fileLabels[missing]}.`;
    } else if (step === 2) {
      if (!this.preparedIdentity()) message = 'Vui lòng xác minh CCCD và khuôn mặt trước.';
      else if (this.form.fullName.trim().length < 2) message = 'Không đọc được họ tên hợp lệ từ CCCD.';
      else if (!/^(0\d{9}|\+84\d{9})$/.test(this.form.phone.replace(/[\s.-]/g, ''))) message = 'Số điện thoại không đúng định dạng.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) message = 'Email không đúng định dạng.';
      else if (!/^\d{12}$/.test(this.form.identityNumber.trim())) message = 'Không đọc được số CCCD hợp lệ.';
    } else if (step === 3) {
      if (this.form.businessName.trim().length < 2) message = 'Vui lòng nhập tên doanh nghiệp / cơ sở.';
      else if (!/^(\d{10}|\d{13})$/.test(this.form.taxCode.trim())) message = 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
    } else {
      if (this.form.address.trim().length < 3) message = 'Vui lòng nhập địa chỉ chi tiết.';
      else if (![this.form.ward, this.form.city].every(value => value.trim())) {
        message = 'Vui lòng nhập đầy đủ phường/xã và tỉnh/thành phố.';
      }
    }
    if (message && notify) this.notify.warning(message);
    return !message;
  }

  private moveToStep(step: number): void {
    this.currentStep.set(step);
    this.furthestStep.update(current => Math.max(current, step));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private isBusy(): boolean {
    return this.submitting() || this.verifying();
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    const response = error as { error?: { message?: string } } | null;
    return response?.error?.message || fallback;
  }

  private resetForm(): void {
    this.form = this.emptyForm();
    this.files = this.emptyFiles();
    this.preparedIdentity.set(null);
    this.currentStep.set(1);
    this.furthestStep.set(1);
    this.selectedAddressValue = '';
    this.addressSuggestions.set([]);
  }

  private emptyForm(): ApplicationForm {
    return {
      fullName: '',
      phone: '',
      email: '',
      identityNumber: '',
      businessName: '',
      businessType: BusinessType.INDIVIDUAL,
      taxCode: '',
      address: '',
      ward: '',
      district: '',
      city: '',
      latitude: null,
      longitude: null
    };
  }

  private emptyFiles(): Record<FileKey, File | null> {
    return { idCardFront: null, idCardBack: null, businessLicense: null, venueImage: null };
  }

  private showSubmissionLoader(mode: 'submission' | 'verification' = 'submission'): void {
    if (this.submissionOverlayRef?.hasAttached()) return;
    this.submissionOverlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'owner-submission-backdrop',
      panelClass: 'owner-submission-panel',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      disposeOnNavigation: true
    });
    const componentRef = this.submissionOverlayRef.attach(new ComponentPortal(
      VenueOwnerSubmissionLoaderComponent,
      this.viewContainerRef
    ));
    if (mode === 'verification') {
      componentRef.setInput('title', 'Đang xác minh danh tính');
      componentRef.setInput(
        'message',
        'GoatSports đang đọc thông tin CCCD, kiểm tra người thật và đối chiếu khuôn mặt. Vui lòng giữ nguyên màn hình.'
      );
    }
  }

  private hideSubmissionLoader(): void {
    this.submissionOverlayRef?.dispose();
    this.submissionOverlayRef = null;
  }
}
