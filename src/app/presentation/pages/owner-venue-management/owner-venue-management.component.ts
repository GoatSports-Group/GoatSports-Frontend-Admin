import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
  take
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AddressSuggestion } from '@application/dto/owner-application/address-suggestion.dto';
import { OwnerVenueOverview, OwnerVenueUpdate } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { SearchAddressSuggestionsUseCase } from '@application/usecase/owner-application/search-address-suggestions.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { GetOwnerVenueOverviewUseCase } from '@application/usecase/venue-owner-dashboard/get-owner-venue-overview.usecase';
import { UpdateOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/update-owner-venue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { UploadVenueImageUseCase } from '@application/usecase/storage/upload-venue-image.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { VenueImageItem } from './venue-image.model';

@Component({
  selector: 'app-owner-venue-management',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideIconComponent, PageLoadingComponent],
  templateUrl: './owner-venue-management.component.html',
  styleUrls: [
    './owner-venue-management.component.scss',
    './owner-venue-form.component.scss',
    './owner-venue-responsive.component.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerVenueManagementComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly getMyVenues = inject(GetMyOwnerVenuesUseCase);
  private readonly getVenueOverview = inject(GetOwnerVenueOverviewUseCase);
  private readonly updateVenue = inject(UpdateOwnerVenueUseCase);
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  private readonly uploadVenueImage = inject(UploadVenueImageUseCase);
  private readonly searchAddressSuggestions = inject(SearchAddressSuggestionsUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly addressInput = new Subject<string>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly venues = signal<OwnerVenueOverview[]>([]);
  readonly selectedVenueId = signal<string | null>(null);
  readonly venue = signal<OwnerVenueOverview | null>(null);
  readonly venueSearch = signal('');
  readonly venuePage = signal(1);
  readonly addingAmenity = signal(false);
  readonly selectedAddressValue = signal('');
  readonly addressSelectedFromVietMap = signal(false);
  readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  readonly addressSearchLoading = signal(false);
  readonly addressDetailLoading = signal(false);
  readonly addressSuggestionsOpen = signal(false);
  readonly addressSearchError = signal('');
  readonly activeSuggestionIndex = signal(-1);
  readonly galleryOpen = signal(false);
  readonly galleryIndex = signal(0);
  readonly images = signal<VenueImageItem[]>([]);
  readonly primaryImageId = signal<string | null>(null);
  readonly venuePageSize = 5;
  readonly uploadingImages = computed(() => this.images().some(image => image.uploading));
  readonly activeVenueCount = computed(() => this.venues().filter(venue => venue.active).length);
  readonly selectionLocked = computed(() => this.saving() || this.uploadingImages()
    || this.detailLoading() || this.addressDetailLoading());
  readonly filteredVenues = computed(() => {
    const query = this.venueSearch().trim().toLocaleLowerCase('vi');
    if (!query) return this.venues();
    return this.venues().filter(venue => [venue.name, this.venueAddress(venue)]
      .some(value => value.toLocaleLowerCase('vi').includes(query)));
  });
  readonly venuePageCount = computed(() => Math.max(1, Math.ceil(this.filteredVenues().length / this.venuePageSize)));
  readonly pagedVenues = computed(() => {
    const page = Math.min(this.venuePage(), this.venuePageCount());
    const start = (page - 1) * this.venuePageSize;
    return this.filteredVenues().slice(start, start + this.venuePageSize);
  });
  readonly primaryImage = computed(() => this.images().find(image => image.id === this.primaryImageId()) ?? this.images()[0] ?? null);
  readonly secondaryImages = computed(() => {
    const primaryId = this.primaryImage()?.id;
    return this.images().filter(image => image.id !== primaryId);
  });
  readonly visibleSecondaryImages = computed(() => this.secondaryImages().slice(0, 5));
  readonly hiddenImageCount = computed(() => Math.max(0, this.secondaryImages().length - 5));
  readonly galleryImages = computed(() => {
    const primary = this.primaryImage();
    return primary ? [primary, ...this.secondaryImages()] : [];
  });
  readonly currentGalleryImage = computed(() => this.galleryImages()[this.galleryIndex()] ?? null);

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
    amenities: [[] as string[]]
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseLocalPreviews(this.images()));
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
    this.load();
  }

  onAddressInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value !== this.selectedAddressValue()) {
      this.selectedAddressValue.set('');
      this.addressSelectedFromVietMap.set(false);
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
      const current = this.activeSuggestionIndex();
      this.activeSuggestionIndex.set((current + direction + suggestions.length) % suggestions.length);
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
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.addressDetailLoading.set(false))
    ).subscribe({
      next: resolved => {
        const address = resolved.address || resolved.formattedAddress;
        this.form.patchValue({
          address,
          ward: resolved.ward,
          district: resolved.district,
          city: resolved.city
        });
        this.selectedAddressValue.set(address);
        this.addressSelectedFromVietMap.set(true);
        this.addressSuggestions.set([]);
        this.addressSearchError.set('');
        this.form.markAsDirty();
      },
      error: () => {
        this.addressSearchError.set('Không thể lấy chi tiết địa chỉ từ VietMap. Vui lòng thử lại.');
        this.addressSuggestionsOpen.set(true);
      }
    });
  }

  load(): void {
    if (this.loading() && this.venues().length) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.getMyVenues.execute().pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: venues => {
        this.venues.set(venues);
        if (!venues.length) {
          this.selectedVenueId.set(null);
          this.venue.set(null);
          this.syncImages([]);
          return;
        }

        const selectedId = venues.some(item => item.venueId === this.selectedVenueId())
          ? this.selectedVenueId()!
          : venues[0].venueId;
        this.loadVenueDetail(selectedId);
      },
      error: error => {
        this.venues.set([]);
        this.selectedVenueId.set(null);
        this.venue.set(null);
        this.syncImages([]);
        this.loadError.set(this.errorMessage(error, 'Không thể tải danh sách cơ sở.'));
      }
    });
  }

  selectVenue(venueId: string): void {
    if (venueId === this.selectedVenueId() || this.selectionLocked()) return;
    if (this.form.dirty && !window.confirm('Bạn có thay đổi chưa lưu. Chuyển cơ sở sẽ hủy các thay đổi này.')) {
      return;
    }
    this.loadVenueDetail(venueId);
  }

  updateVenueSearch(event: Event): void {
    this.venueSearch.set((event.target as HTMLInputElement).value);
    this.venuePage.set(1);
  }

  previousVenuePage(): void {
    this.venuePage.update(page => Math.max(1, page - 1));
  }

  nextVenuePage(): void {
    this.venuePage.update(page => Math.min(this.venuePageCount(), page + 1));
  }

  venueThumbnail(venue: OwnerVenueOverview): string | null {
    if (venue.venueId === this.selectedVenueId()) return this.primaryImage()?.displayUrl ?? null;
    const firstImage = venue.imageUrls?.[0];
    return firstImage && this.isHttpUrl(firstImage) ? firstImage : null;
  }

  retrySelectedVenue(): void {
    const venueId = this.selectedVenueId();
    if (venueId && !this.detailLoading()) this.loadVenueDetail(venueId);
  }

  venueAddress(venue: OwnerVenueOverview): string {
    return [venue.district, venue.city]
      .map(value => value?.trim())
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(', ') || 'Địa chỉ đang cập nhật';
  }

  submit(primaryImageIdOnError?: string | null): void {
    if (this.saving() || this.uploadingImages()) {
      this.restorePrimaryImage(primaryImageIdOnError);
      return;
    }
    this.form.markAllAsTouched();
    const venue = this.venue();
    if (!venue || this.form.invalid || !this.validateBusinessRules()) {
      this.restorePrimaryImage(primaryImageIdOnError);
      return;
    }

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
        this.venues.update(venues => venues.map(item => item.venueId === updated.venueId ? updated : item));
        this.patchForm(updated, true);
        this.form.markAsPristine();
        this.notify.success('Thông tin cơ sở đã được cập nhật.');
      },
      error: error => {
        this.restorePrimaryImage(primaryImageIdOnError);
        this.notify.error(this.errorMessage(error, 'Cập nhật cơ sở thất bại.'));
      }
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

  amenityItems(): string[] {
    return this.form.controls.amenities.value;
  }

  addAmenity(input: HTMLInputElement, event?: Event): void {
    event?.preventDefault();
    if (!this.addingAmenity()) {
      if (this.amenityItems().length >= 30) {
        this.notify.warning('Tiện ích không được vượt quá 30 mục.');
        return;
      }
      this.addingAmenity.set(true);
      setTimeout(() => input.focus());
      return;
    }

    const amenity = input.value.trim();
    if (!amenity) return;

    const current = this.amenityItems();
    if (current.some(item => item.toLocaleLowerCase('vi') === amenity.toLocaleLowerCase('vi'))) {
      input.value = '';
      return;
    }
    if (current.length >= 30) {
      this.notify.warning('Tiện ích không được vượt quá 30 mục.');
      return;
    }

    this.form.controls.amenities.setValue([...current, amenity]);
    this.form.controls.amenities.markAsDirty();
    input.value = '';
    this.addingAmenity.set(false);
  }

  removeAmenity(amenity: string): void {
    const remaining = this.amenityItems().filter(item => item !== amenity);
    this.form.controls.amenities.setValue(remaining);
    this.form.controls.amenities.markAsDirty();
  }

  openImageGallery(image: VenueImageItem): void {
    const index = this.galleryImages().findIndex(item => item.id === image.id);
    if (index < 0) return;
    this.galleryIndex.set(index);
    this.galleryOpen.set(true);
  }

  closeImageGallery(): void {
    this.galleryOpen.set(false);
  }

  previousGalleryImage(): void {
    const count = this.galleryImages().length;
    if (count < 2) return;
    this.galleryIndex.update(index => (index - 1 + count) % count);
  }

  nextGalleryImage(): void {
    const count = this.galleryImages().length;
    if (count < 2) return;
    this.galleryIndex.update(index => (index + 1) % count);
  }

  @HostListener('document:keydown', ['$event'])
  handleGalleryKeyboard(event: KeyboardEvent): void {
    if (!this.galleryOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeImageGallery();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previousGalleryImage();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextGalleryImage();
    }
  }

  cancelAmenity(input: HTMLInputElement): void {
    input.value = '';
    this.addingAmenity.set(false);
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
    const remainingImages = this.images().filter(item => item.id !== image.id);
    this.images.set(remainingImages);
    if (!remainingImages.some(item => item.id === this.primaryImageId())) {
      this.primaryImageId.set(remainingImages[0]?.id ?? null);
    }
    this.form.markAsDirty();
  }

  isPrimaryImage(image: VenueImageItem): boolean {
    return this.primaryImageId() === image.id;
  }

  handleImageError(image: VenueImageItem): void {
    if (image.localPreview) return;
    this.updateImage(image.id, item => ({ ...item, displayUrl: null, resolving: false }));
  }

  setPrimaryImage(image: VenueImageItem): void {
    if (this.saving() || this.uploadingImages() || image.uploading || this.isPrimaryImage(image)) return;
    if (!this.images().some(item => item.id === image.id)) return;
    const previousPrimaryImageId = this.primaryImageId();
    this.primaryImageId.set(image.id);
    this.form.markAsDirty();
    this.submit(previousPrimaryImageId);
  }

  private loadVenueDetail(venueId: string): void {
    this.selectedVenueId.set(venueId);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.venue.set(null);
    this.syncImages([]);

    this.getVenueOverview.execute(venueId).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.detailLoading.set(false))
    ).subscribe({
      next: venue => {
        this.venue.set(venue);
        this.venues.update(venues => venues.map(item => item.venueId === venue.venueId ? venue : item));
        this.patchForm(venue);
        this.form.markAsPristine();
      },
      error: error => {
        this.detailError.set(this.errorMessage(error, 'Không thể tải chi tiết cơ sở đã chọn.'));
      }
    });
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
    if (value.amenities.length > 30) {
      this.notify.warning('Tiện ích không được vượt quá 30 mục.');
      return false;
    }
    return true;
  }

  private patchForm(venue: OwnerVenueOverview, preserveLocalImagePreviews = false): void {
    this.form.patchValue({
      name: venue.name ?? '', description: venue.description ?? '', openTime: this.time(venue.openTime),
      closeTime: this.time(venue.closeTime), active: venue.active ?? false,
      minPrice: venue.minPrice ?? 0, maxPrice: venue.maxPrice ?? 0, phone: venue.phone ?? '',
      email: venue.email ?? '', address: venue.address ?? '', ward: venue.ward ?? '',
      district: venue.district ?? '', city: venue.city ?? '',
      amenities: [...(venue.amenities ?? [])]
    });
    this.selectedAddressValue.set(venue.address ?? '');
    this.addressSelectedFromVietMap.set(false);
    this.addressSuggestions.set([]);
    this.addressSuggestionsOpen.set(false);
    this.addressSearchError.set('');
    this.activeSuggestionIndex.set(-1);
    this.addingAmenity.set(false);
    this.syncImages(venue.imageUrls ?? [], preserveLocalImagePreviews);
  }

  private toRequest(): OwnerVenueUpdate {
    const value = this.form.getRawValue();
    return {
      ...value,
      description: value.description.trim() || undefined,
      ward: value.ward.trim() || undefined,
      district: value.district.trim() || undefined,
      imageUrls: this.imageKeysInSaveOrder(),
      amenities: value.amenities
    };
  }

  private time(value?: string): string {
    return value?.slice(0, 5) ?? '';
  }

  private startImageUpload(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.notify.error(`${file.name} không phải là tệp hình ảnh hợp lệ.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notify.error(`${file.name} vượt quá giới hạn 10 MB.`);
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    const becomesPrimaryImage = this.images().length === 0;
    this.images.update(items => [...items, {
      id, key: null, displayUrl: previewUrl, fileName: file.name,
      uploading: true, resolving: false, localPreview: true
    }]);
    if (becomesPrimaryImage) this.primaryImageId.set(id);
    this.form.markAsDirty();

    this.uploadVenueImage.execute(file).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: objectKey => this.updateImage(id, image => ({ ...image, key: objectKey, uploading: false })),
      error: error => {
        URL.revokeObjectURL(previewUrl);
        const remainingImages = this.images().filter(image => image.id !== id);
        this.images.set(remainingImages);
        if (this.primaryImageId() === id) {
          this.primaryImageId.set(remainingImages[0]?.id ?? null);
        }
        this.notify.error(this.errorMessage(error, `Không thể tải ảnh ${file.name}. Ảnh đã được hủy khỏi lựa chọn.`));
      }
    });
  }

  private syncImages(keys: string[], preserveLocalPreviews = false): void {
    this.closeImageGallery();
    this.galleryIndex.set(0);
    const previousImages = this.images();
    const retainedPreviewIds = new Set<string>();
    const items = keys.map((key, index): VenueImageItem => {
      const preserved = preserveLocalPreviews
        ? previousImages.find(image => image.localPreview && image.displayUrl && image.key === key)
          ?? (previousImages[index]?.localPreview && previousImages[index]?.displayUrl
            ? previousImages[index]
            : undefined)
        : undefined;

      if (preserved) {
        retainedPreviewIds.add(preserved.id);
        return { ...preserved, key, uploading: false, resolving: false };
      }

      return {
        id: `stored-${index}-${key}`,
        key,
        displayUrl: this.isHttpUrl(key) ? key : null,
        fileName: this.fileName(key),
        uploading: false,
        resolving: !this.isHttpUrl(key),
        localPreview: false
      };
    });
    this.releaseLocalPreviews(previousImages.filter(image => !retainedPreviewIds.has(image.id)));
    this.images.set(items);
    this.primaryImageId.set(items[0]?.id ?? null);
    items.filter(item => item.resolving).forEach(item => this.resolveImage(item));
  }

  private imageKeysInSaveOrder(): string[] {
    const images = this.images();
    const primaryImage = images.find(image => image.id === this.primaryImageId());
    const orderedImages = primaryImage
      ? [primaryImage, ...images.filter(image => image.id !== primaryImage.id)]
      : images;
    return orderedImages
      .map(image => image.key)
      .filter((key): key is string => Boolean(key));
  }

  private restorePrimaryImage(primaryImageId?: string | null): void {
    if (primaryImageId !== undefined) this.primaryImageId.set(primaryImageId);
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
    const storedName = decodeURIComponent(key.split('/').pop() || 'Hình ảnh cơ sở');
    return storedName.replace(
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-(?=.+)/i,
      ''
    );
  }

  private isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
