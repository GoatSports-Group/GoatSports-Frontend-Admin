import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OwnerVenueOverview, OwnerVenueUpdate } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venue.usecase';
import { UpdateOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/update-owner-venue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { UploadVenueImageUseCase } from '@application/usecase/storage/upload-venue-image.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { VenueImageItem } from './venue-image.model';

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
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  private readonly uploadVenueImage = inject(UploadVenueImageUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly venue = signal<OwnerVenueOverview | null>(null);
  readonly images = signal<VenueImageItem[]>([]);
  readonly uploadingImages = computed(() => this.images().some(image => image.uploading));

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
    amenities: ['']
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseLocalPreviews(this.images()));
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
    if (this.saving() || this.uploadingImages()) return;
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
    if (venue && !this.saving() && !this.uploadingImages()) {
      this.patchForm(venue);
      this.form.markAsPristine();
    }
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  selectImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    input.value = '';
    if (!selected.length) return;

    const remaining = Math.max(0, 12 - this.images().length);
    if (!remaining) {
      this.notify.warning('Cơ sở chỉ được lưu tối đa 12 hình ảnh.');
      return;
    }
    if (selected.length > remaining) {
      this.notify.warning(`Chỉ còn có thể chọn thêm ${remaining} hình ảnh.`);
    }

    selected.slice(0, remaining).forEach(file => this.startImageUpload(file));
  }

  removeImage(image: VenueImageItem): void {
    if (image.uploading || this.saving()) return;
    if (image.localPreview && image.displayUrl) URL.revokeObjectURL(image.displayUrl);
    this.images.update(items => items.filter(item => item.id !== image.id));
    this.form.markAsDirty();
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
    const imageKeys = this.images().map(image => image.key).filter((key): key is string => Boolean(key));
    if (imageKeys.length !== this.images().length || imageKeys.length > 12
      || imageKeys.some(item => item.length > 2048)) {
      this.notify.warning('Vui lòng chờ tải ảnh hoàn tất; tối đa 12 ảnh cho mỗi cơ sở.');
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
      longitude: venue.longitude ?? null,
      amenities: (venue.amenities ?? []).join('\n')
    });
    this.syncImages(venue.imageUrls ?? []);
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
      imageUrls: this.images().map(image => image.key).filter((key): key is string => Boolean(key)),
      amenities: this.toList(value.amenities)
    };
  }

  private toList(value: string): string[] {
    return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))];
  }

  private time(value?: string): string {
    return value?.slice(0, 5) ?? '';
  }

  private startImageUpload(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.notify.error(`${file.name} không phải là tệp hình ảnh hợp lệ.`);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.notify.error(`${file.name} vượt quá giới hạn 2 MB.`);
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    this.images.update(items => [...items, {
      id, key: null, displayUrl: previewUrl, fileName: file.name,
      uploading: true, resolving: false, localPreview: true
    }]);
    this.form.markAsDirty();

    this.uploadVenueImage.execute(file).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: objectKey => this.updateImage(id, image => ({ ...image, key: objectKey, uploading: false })),
      error: error => {
        URL.revokeObjectURL(previewUrl);
        this.images.update(items => items.filter(image => image.id !== id));
        this.notify.error(this.errorMessage(error, `Không thể tải ảnh ${file.name}. Ảnh đã được hủy khỏi lựa chọn.`));
      }
    });
  }

  private syncImages(keys: string[]): void {
    this.releaseLocalPreviews(this.images());
    const items = keys.map((key, index): VenueImageItem => ({
      id: `stored-${index}-${key}`,
      key,
      displayUrl: this.isHttpUrl(key) ? key : null,
      fileName: this.fileName(key),
      uploading: false,
      resolving: !this.isHttpUrl(key),
      localPreview: false
    }));
    this.images.set(items);
    items.filter(item => item.resolving).forEach(item => this.resolveImage(item));
  }

  private resolveImage(image: VenueImageItem): void {
    if (!image.key) return;
    this.getFileUrl.execute(image.key).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: url => this.updateImage(image.id, item => ({ ...item, displayUrl: url, resolving: false })),
      error: () => this.updateImage(image.id, item => ({ ...item, resolving: false }))
    });
  }

  private updateImage(id: string, update: (image: VenueImageItem) => VenueImageItem): void {
    this.images.update(items => items.map(image => image.id === id ? update(image) : image));
  }

  private releaseLocalPreviews(images: VenueImageItem[]): void {
    images.filter(image => image.localPreview && image.displayUrl)
      .forEach(image => URL.revokeObjectURL(image.displayUrl!));
  }

  private fileName(key: string): string {
    return decodeURIComponent(key.split('/').pop() || 'Hình ảnh cơ sở');
  }

  private isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
