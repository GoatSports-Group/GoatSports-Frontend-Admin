import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OwnerVenueOverview, OwnerVenueUpdate } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venue.usecase';
import { UpdateOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/update-owner-venue.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-owner-venue-management',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideIconComponent],
  templateUrl: './owner-venue-management.component.html',
  styleUrl: './owner-venue-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerVenueManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getMyVenue = inject(GetMyOwnerVenueUseCase);
  private readonly updateVenue = inject(UpdateOwnerVenueUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly venue = signal<OwnerVenueOverview | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', Validators.maxLength(2000)],
    openTime: ['', Validators.required],
    closeTime: ['', Validators.required],
    active: [false],
    minPrice: [0, [Validators.required, Validators.min(0)]],
    maxPrice: [0, [Validators.required, Validators.min(0)]],
    phone: ['', [Validators.required, Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    address: ['', [Validators.required, Validators.maxLength(500)]],
    ward: ['', Validators.maxLength(255)],
    district: ['', Validators.maxLength(255)],
    city: ['', [Validators.required, Validators.maxLength(255)]],
    latitude: this.formBuilder.control<number | null>(null, [Validators.min(-90), Validators.max(90)]),
    longitude: this.formBuilder.control<number | null>(null, [Validators.min(-180), Validators.max(180)]),
    imageUrls: [''],
    amenities: ['']
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (this.loading() && this.venue()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.getMyVenue.execute().pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: venue => {
        this.venue.set(venue);
        if (venue) this.patchForm(venue);
      },
      error: error => {
        this.venue.set(null);
        this.loadError.set(this.errorMessage(error, 'Không thể tải thông tin cơ sở.'));
      }
    });
  }

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const venue = this.venue();
    if (!venue || this.form.invalid || !this.validateBusinessRules()) return;

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.updateVenue.execute(venue.venueId, this.toRequest()).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
      })
    ).subscribe({
      next: updated => {
        this.venue.set(updated);
        this.patchForm(updated);
        this.form.markAsPristine();
        this.notify.success('Thông tin cơ sở đã được cập nhật.');
      },
      error: error => this.notify.error(this.errorMessage(error, 'Cập nhật cơ sở thất bại.'))
    });
  }

  reset(): void {
    const venue = this.venue();
    if (venue && !this.saving()) {
      this.patchForm(venue);
      this.form.markAsPristine();
    }
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  private validateBusinessRules(): boolean {
    const value = this.form.getRawValue();
    if (value.openTime >= value.closeTime) {
      this.notify.warning('Giờ đóng cửa phải sau giờ mở cửa.');
      return false;
    }
    if (value.minPrice > value.maxPrice) {
      this.notify.warning('Giá tối thiểu không được lớn hơn giá tối đa.');
      return false;
    }
    const images = this.toList(value.imageUrls);
    if (images.length > 12 || images.some(item => item.length > 2048)) {
      this.notify.warning('Chỉ được lưu tối đa 12 đường dẫn hình ảnh, mỗi đường dẫn không quá 2048 ký tự.');
      return false;
    }
    if (this.toList(value.amenities).length > 30) {
      this.notify.warning('Tiện ích không được vượt quá 30 mục.');
      return false;
    }
    return true;
  }

  private patchForm(venue: OwnerVenueOverview): void {
    this.form.patchValue({
      name: venue.name ?? '', description: venue.description ?? '', openTime: this.time(venue.openTime),
      closeTime: this.time(venue.closeTime), active: venue.active ?? false,
      minPrice: venue.minPrice ?? 0, maxPrice: venue.maxPrice ?? 0, phone: venue.phone ?? '',
      email: venue.email ?? '', address: venue.address ?? '', ward: venue.ward ?? '',
      district: venue.district ?? '', city: venue.city ?? '', latitude: venue.latitude ?? null,
      longitude: venue.longitude ?? null, imageUrls: (venue.imageUrls ?? []).join('\n'),
      amenities: (venue.amenities ?? []).join('\n')
    });
  }

  private toRequest(): OwnerVenueUpdate {
    const value = this.form.getRawValue();
    return {
      ...value,
      description: value.description.trim() || undefined,
      ward: value.ward.trim() || undefined,
      district: value.district.trim() || undefined,
      latitude: value.latitude ?? undefined,
      longitude: value.longitude ?? undefined,
      imageUrls: this.toList(value.imageUrls),
      amenities: this.toList(value.amenities)
    };
  }

  private toList(value: string): string[] {
    return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))];
  }

  private time(value?: string): string {
    return value?.slice(0, 5) ?? '';
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
