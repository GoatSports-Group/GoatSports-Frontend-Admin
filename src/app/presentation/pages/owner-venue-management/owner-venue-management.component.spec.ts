import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideChevronLeft, LucideChevronRight, LucideCircleCheck, LucideClipboardCheck,
  LucideClock, LucideImage, LucideInbox, LucideMapPin, LucidePhone, LucidePlus, LucideReceipt,
  LucideSave, LucideSearch, LucideSparkles, LucideStar, LucideStore, LucideUpload, LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { SearchAddressSuggestionsUseCase } from '@application/usecase/owner-application/search-address-suggestions.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { GetOwnerVenueOverviewUseCase } from '@application/usecase/venue-owner-dashboard/get-owner-venue-overview.usecase';
import { UpdateOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/update-owner-venue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { UploadVenueImageUseCase } from '@application/usecase/storage/upload-venue-image.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OwnerVenueManagementComponent } from './owner-venue-management.component';

describe('OwnerVenueManagementComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', description: 'Cơ sở thể thao',
    openTime: '06:00:00', closeTime: '22:00:00', active: false,
    minPrice: 100000, maxPrice: 300000, phone: '0909000000', email: 'owner@goat.vn',
    address: '1 Goat Street', ward: 'Bến Nghé', district: 'Quận 1', city: 'Hồ Chí Minh',
    imageUrls: [], amenities: [], courts: []
  };
  const getMyVenues = { execute: vi.fn() };
  const getVenueOverview = { execute: vi.fn() };
  const updateVenue = { execute: vi.fn() };
  const getFileUrl = { execute: vi.fn() };
  const uploadVenueImage = { execute: vi.fn() };
  const searchAddress = { execute: vi.fn(), resolve: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenues.execute.mockReset().mockReturnValue(of([venue]));
    getVenueOverview.execute.mockReset().mockReturnValue(of(venue));
    updateVenue.execute.mockReset().mockReturnValue(of(venue));
    getFileUrl.execute.mockReset().mockReturnValue(of('https://cdn.goat.test/venue.png'));
    uploadVenueImage.execute.mockReset().mockReturnValue(of('temp/venues/owner/new.png'));
    searchAddress.execute.mockReset().mockReturnValue(of([]));
    searchAddress.resolve.mockReset();
    notify.success.mockReset(); notify.error.mockReset(); notify.warning.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerVenueManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideAlertCircle, LucideChevronLeft, LucideChevronRight, LucideCircleCheck, LucideClipboardCheck,
          LucideClock, LucideImage, LucideInbox, LucideMapPin, LucidePhone, LucidePlus, LucideReceipt,
          LucideSave, LucideSearch, LucideSparkles, LucideStar, LucideStore, LucideUpload, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getMyVenues },
        { provide: GetOwnerVenueOverviewUseCase, useValue: getVenueOverview },
        { provide: UpdateOwnerVenueUseCase, useValue: updateVenue },
        { provide: GetStorageFileUrlUseCase, useValue: getFileUrl },
        { provide: UploadVenueImageUseCase, useValue: uploadVenueImage },
        { provide: SearchAddressSuggestionsUseCase, useValue: searchAddress },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('hiển thị empty state thật khi owner chưa có Venue', () => {
    getMyVenues.execute.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.venue()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('chưa có cơ sở được phê duyệt');
  });

  it('chặn double submit trong khi request cập nhật đang chạy', () => {
    const pending = new Subject<OwnerVenueOverview>();
    updateVenue.execute.mockReturnValue(pending);
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.name.setValue('Goat Sports Center');

    component.submit();
    component.submit();

    expect(updateVenue.execute).toHaveBeenCalledOnce();
    expect(component.saving()).toBe(true);
    expect(component.form.disabled).toBe(true);
  });

  it('lấy public URL từ storage key để hiển thị ảnh sân có sẵn', () => {
    const venueWithImage = { ...venue, imageUrls: ['venues/owner/old.png'] };
    getMyVenues.execute.mockReturnValue(of([venueWithImage]));
    getVenueOverview.execute.mockReturnValue(of(venueWithImage));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();

    expect(getFileUrl.execute).toHaveBeenCalledWith('venues/owner/old.png');
    expect(fixture.nativeElement.querySelector('.image-card img')?.src)
      .toBe('https://cdn.goat.test/venue.png');
  });

  it('không hiển thị filename và đặt nút xóa trực tiếp trên ảnh', () => {
    const venueWithImage = {
      ...venue,
      imageUrls: ['venues/owner/f1958d44-e701-4e53-8f66-0d831d91dc6d-San-cau-long.png']
    };
    getMyVenues.execute.mockReturnValue(of([venueWithImage]));
    getVenueOverview.execute.mockReturnValue(of(venueWithImage));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();

    const imageCard = fixture.nativeElement.querySelector('.image-card') as HTMLElement;
    expect(imageCard.textContent).not.toContain('San-cau-long.png');
    expect(imageCard.querySelector('.image-card__footer')).toBeNull();
    expect(imageCard.querySelector('button.image-card__remove')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.venue-gallery').classList).toContain('venue-gallery--cover-only');
  });

  it('mặc định dùng ảnh đầu tiên làm ảnh đại diện', () => {
    const venueWithImages = {
      ...venue,
      imageUrls: ['venues/owner/first.png', 'venues/owner/second.png']
    };
    getMyVenues.execute.mockReturnValue(of([venueWithImages]));
    getVenueOverview.execute.mockReturnValue(of(venueWithImages));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();

    const [firstImage, secondImage] = fixture.componentInstance.images();
    expect(fixture.componentInstance.isPrimaryImage(firstImage)).toBe(true);
    expect(fixture.componentInstance.isPrimaryImage(secondImage)).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.image-card.is-primary')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.venue-gallery__thumbnails')?.getAttribute('data-count')).toBe('1');
    expect(fixture.nativeElement.querySelector('.image-card.is-primary .image-card__primary')?.textContent)
      .toContain('Ảnh đại diện');
  });

  it('mở lightbox và chuyển từng ảnh khi nhấn vào số ảnh còn lại', () => {
    const venueWithImages = {
      ...venue,
      imageUrls: Array.from({ length: 8 }, (_, index) => `venues/owner/image-${index + 1}.png`)
    };
    getMyVenues.execute.mockReturnValue(of([venueWithImages]));
    getVenueOverview.execute.mockReturnValue(of(venueWithImages));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const moreButton = fixture.nativeElement.querySelector('button.gallery-more') as HTMLButtonElement;
    expect(moreButton).toBeTruthy();
    moreButton.click();
    fixture.detectChanges();

    expect(component.galleryOpen()).toBe(true);
    expect(component.galleryIndex()).toBe(5);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.gallery-lightbox__stage figure img')).toHaveLength(1);

    (fixture.nativeElement.querySelector('.gallery-lightbox__nav--next') as HTMLButtonElement).click();
    expect(component.galleryIndex()).toBe(6);
    component.handleGalleryKeyboard(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.galleryIndex()).toBe(5);
    component.handleGalleryKeyboard(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.galleryOpen()).toBe(false);
  });

  it('lưu ngay ảnh được chọn lên đầu payload để làm ảnh đại diện', () => {
    const venueWithImages = {
      ...venue,
      imageUrls: ['venues/owner/first.png', 'venues/owner/second.png']
    };
    getMyVenues.execute.mockReturnValue(of([venueWithImages]));
    getVenueOverview.execute.mockReturnValue(of(venueWithImages));
    updateVenue.execute.mockReturnValue(of({
      ...venueWithImages,
      imageUrls: ['venues/owner/second.png', 'venues/owner/first.png']
    }));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const selectButton = fixture.nativeElement.querySelectorAll('.image-card')[1]
      .querySelector('button.image-card__primary') as HTMLButtonElement;
    selectButton.click();
    fixture.detectChanges();

    expect(updateVenue.execute).toHaveBeenCalledOnce();
    expect(updateVenue.execute).toHaveBeenCalledWith('venue-1', expect.objectContaining({
      imageUrls: ['venues/owner/second.png', 'venues/owner/first.png']
    }));
    const updatePayload = updateVenue.execute.mock.calls[0][1];
    expect(updatePayload).not.toHaveProperty('latitude');
    expect(updatePayload).not.toHaveProperty('longitude');
    expect(updatePayload.amenities).toEqual([]);
    expect(component.images()[0].key).toBe('venues/owner/second.png');
    expect(component.isPrimaryImage(component.images()[0])).toBe(true);
    expect(component.form.pristine).toBe(true);
  });

  it('hiển thị và chỉnh sửa amenities dưới dạng danh sách badge', () => {
    const venueWithAmenities = {
      ...venue,
      amenities: ['Sân cỏ nhân tạo', 'Bãi giữ xe']
    };
    getMyVenues.execute.mockReturnValue(of([venueWithAmenities]));
    getVenueOverview.execute.mockReturnValue(of(venueWithAmenities));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect([...fixture.nativeElement.querySelectorAll('.amenity-chip')]
      .map((element: Element) => element.textContent?.trim())).toEqual([
      'Sân cỏ nhân tạo',
      'Bãi giữ xe'
    ]);

    component.removeAmenity('Bãi giữ xe');
    expect(component.form.controls.amenities.value).toEqual(['Sân cỏ nhân tạo']);
  });

  it('dùng gợi ý VietMap để tự điền các trường địa chỉ hành chính', () => {
    const suggestion = {
      id: 'vietmap-1',
      refId: 'ref-1',
      title: '12 Trần Phú',
      formattedAddress: '12 Trần Phú, Lộc Thọ, Nha Trang, Khánh Hòa',
      address: '12 Trần Phú',
      ward: 'Lộc Thọ',
      district: 'Nha Trang',
      city: 'Khánh Hòa',
      latitude: 12.2388,
      longitude: 109.1967
    };
    searchAddress.resolve.mockReturnValue(of(suggestion));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectAddressSuggestion(suggestion);
    fixture.detectChanges();

    expect(searchAddress.resolve).toHaveBeenCalledWith(suggestion);
    expect(component.form.controls.address.value).toBe('12 Trần Phú');
    expect(component.form.controls.ward.value).toBe('Lộc Thọ');
    expect(component.form.controls.district.value).toBe('Nha Trang');
    expect(component.form.controls.city.value).toBe('Khánh Hòa');
    expect(component.addressSelectedFromVietMap()).toBe(true);
    expect(component.form.dirty).toBe(true);
  });

  it('hủy ảnh vừa chọn và báo lỗi khi upload presigned URL thất bại', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:venue-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    uploadVenueImage.execute.mockReturnValue(throwError(() => new Error('R2 unavailable')));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const file = new File(['image'], 'venue.png', { type: 'image/png' });

    fixture.componentInstance.selectImages({ target: { files: [file], value: '' } } as unknown as Event);

    expect(fixture.componentInstance.images()).toEqual([]);
    expect(notify.error).toHaveBeenCalledWith('Không thể tải ảnh venue.png. Ảnh đã được hủy khỏi lựa chọn.');
  });

  it('giữ preview tạm sau khi cập nhật để không hiển thị ảnh vỡ trong lúc đồng bộ storage', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:venue-preview');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    revokeObjectUrl.mockClear();
    updateVenue.execute.mockReturnValue(of({
      ...venue,
      imageUrls: ['temp/venues/owner/new.png']
    }));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const file = new File(['image'], 'venue.png', { type: 'image/png' });

    component.selectImages({ target: { files: [file], value: '' } } as unknown as Event);
    component.submit();
    fixture.detectChanges();

    expect(updateVenue.execute).toHaveBeenCalledOnce();
    expect(component.images()[0]).toEqual(expect.objectContaining({
      key: 'temp/venues/owner/new.png',
      displayUrl: 'blob:venue-preview',
      localPreview: true,
      uploading: false
    }));
    expect(revokeObjectUrl).not.toHaveBeenCalledWith('blob:venue-preview');
    expect((fixture.nativeElement.querySelector('.image-card--cover img') as HTMLImageElement).src)
      .toBe('blob:venue-preview');
  });

  it('hiển thị nhiều cơ sở và tải đúng chi tiết khi owner chuyển lựa chọn', () => {
    const secondVenue: OwnerVenueOverview = {
      ...venue,
      venueId: 'venue-2',
      name: 'Goat Arena Thủ Đức',
      district: 'Thủ Đức',
      active: true,
      courts: [{ venueCourtId: 'court-2', venueId: 'venue-2', name: 'Sân 2', sportType: 'BADMINTON', capacity: 4, surfaceType: 'PVC', active: true }]
    };
    getMyVenues.execute.mockReturnValue(of([venue, secondVenue]));
    getVenueOverview.execute.mockImplementation((venueId: string) => of(venueId === 'venue-2' ? secondVenue : venue));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.venue-option')).toHaveLength(2);
    fixture.componentInstance.selectVenue('venue-2');
    fixture.detectChanges();

    expect(getVenueOverview.execute).toHaveBeenLastCalledWith('venue-2');
    expect(fixture.componentInstance.selectedVenueId()).toBe('venue-2');
    expect(fixture.componentInstance.form.controls.name.value).toBe('Goat Arena Thủ Đức');
  });

  it('không chuyển cơ sở khi người dùng giữ lại thay đổi chưa lưu', () => {
    const secondVenue = { ...venue, venueId: 'venue-2', name: 'Goat Arena 2' };
    getMyVenues.execute.mockReturnValue(of([venue, secondVenue]));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.name.setValue('Tên chưa lưu');
    fixture.componentInstance.form.markAsDirty();

    fixture.componentInstance.selectVenue('venue-2');

    expect(confirm).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.selectedVenueId()).toBe('venue-1');
    expect(getVenueOverview.execute).toHaveBeenCalledTimes(1);
  });
});
