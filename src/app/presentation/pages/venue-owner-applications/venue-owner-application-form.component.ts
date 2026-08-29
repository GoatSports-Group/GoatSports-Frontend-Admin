import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessType } from '@application/dto/owner-application/owner-application.dto';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';

type FileKey = 'idCardFront' | 'idCardBack' | 'businessLicense' | 'venueImage';
type ApplicationForm = {
  fullName: string; phone: string; email: string; identityNumber: string;
  businessName: string; businessType: BusinessType; taxCode: string;
  address: string; ward: string; district: string; province: string; city: string;
};

@Component({
  selector: 'app-venue-owner-application-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './venue-owner-application-form.component.html',
  styleUrl: './venue-owner-application-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerApplicationFormComponent {
  private readonly submitApplication = inject(SubmitOwnerApplicationUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitted = output<void>();
  readonly currentStep = signal(1);
  readonly submitting = signal(false);
  readonly steps = ['Người đại diện', 'Cơ sở', 'Địa chỉ', 'Hồ sơ'];
  readonly stepDescriptions = ['Thông tin cá nhân', 'Thông tin kinh doanh', 'Địa chỉ cơ sở', 'Giấy tờ pháp lý'];
  readonly fileLabels: Record<FileKey, string> = {
    idCardFront: 'CCCD mặt trước', idCardBack: 'CCCD mặt sau',
    businessLicense: 'Giấy phép kinh doanh', venueImage: 'Hình ảnh cơ sở / sân'
  };
  readonly fileKeys: FileKey[] = ['idCardFront', 'idCardBack', 'businessLicense', 'venueImage'];

  form: ApplicationForm = this.emptyForm();
  files: Record<FileKey, File | null> = this.emptyFiles();

  goToStep(step: number): void {
    if (!this.submitting() && step >= 1 && step <= this.currentStep()) this.currentStep.set(step);
  }

  nextStep(): void {
    if (!this.validateStep(this.currentStep())) return;
    this.currentStep.update(step => Math.min(4, step + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  previousStep(): void {
    this.currentStep.update(step => Math.max(1, step - 1));
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
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      this.notify.warning('Tài liệu chỉ nhận ảnh hoặc PDF.');
      input.value = '';
      return;
    }
    this.files = { ...this.files, [key]: file };
  }

  removeFile(key: FileKey): void {
    if (!this.submitting()) this.files = { ...this.files, [key]: null };
  }

  submit(): void {
    if (this.submitting() || !this.validateAll()) return;
    this.submitting.set(true);
    const form = Object.fromEntries(Object.entries(this.form).map(([key, value]) => [
      key, typeof value === 'string' ? value.trim() : value
    ]));

    defer(() => this.submitApplication.execute(form, {
      idCardFront: this.files.idCardFront!,
      idCardBack: this.files.idCardBack!,
      businessLicense: this.files.businessLicense!,
      venueImage: this.files.venueImage!
    })).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.submitting.set(false))
    ).subscribe({
      next: () => {
        this.form = this.emptyForm();
        this.files = this.emptyFiles();
        this.currentStep.set(1);
        this.notify.success('Đã nộp đơn đăng ký chủ sân thành công.');
        this.submitted.emit();
      },
      error: error => {
        this.notify.error(error?.error?.message || error?.message || 'Đã xảy ra lỗi khi gửi đơn đăng ký.');
      }
    });
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const target = keyboardEvent.target as HTMLElement | null;
    if (this.submitting() || keyboardEvent.repeat || target?.tagName === 'TEXTAREA' || target?.tagName === 'BUTTON') return;
    keyboardEvent.preventDefault();
    this.currentStep() < 4 ? this.nextStep() : this.submit();
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
      if (this.form.fullName.trim().length < 2) message = 'Họ và tên phải có ít nhất 2 ký tự.';
      else if (!/^(0\d{9}|\+84\d{9})$/.test(this.form.phone.replace(/[\s.-]/g, ''))) message = 'Số điện thoại không đúng định dạng.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) message = 'Email không đúng định dạng.';
      else if (!/^[A-Za-z0-9]{6,12}$/.test(this.form.identityNumber.trim())) message = 'CCCD / Hộ chiếu gồm 6–12 ký tự.';
    } else if (step === 2) {
      if (this.form.businessName.trim().length < 2) message = 'Vui lòng nhập tên doanh nghiệp / cơ sở.';
      else if (!/^(\d{10}|\d{13})$/.test(this.form.taxCode.trim())) message = 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
    } else if (step === 3) {
      if (this.form.address.trim().length < 3) message = 'Vui lòng nhập địa chỉ chi tiết.';
      else if (![this.form.ward, this.form.district, this.form.province, this.form.city].every(value => value.trim())) {
        message = 'Vui lòng nhập đầy đủ phường/xã, quận/huyện, tỉnh và thành phố.';
      }
    } else {
      const missing = this.fileKeys.find(key => !this.files[key]);
      if (missing) message = `Vui lòng tải lên ${this.fileLabels[missing]}.`;
    }
    if (message && notify) this.notify.warning(message);
    return !message;
  }

  private emptyForm(): ApplicationForm {
    return {
      fullName: '', phone: '', email: '', identityNumber: '', businessName: '',
      businessType: BusinessType.INDIVIDUAL, taxCode: '', address: '', ward: '',
      district: '', province: '', city: ''
    };
  }

  private emptyFiles(): Record<FileKey, File | null> {
    return { idCardFront: null, idCardBack: null, businessLicense: null, venueImage: null };
  }
}
