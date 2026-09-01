import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideChevronRight, LucideCircleCheck, LucideClipboardCheck, LucideImage,
  LucideInbox, LucideMapPin, LucideReceipt, LucideSave, LucideStar, LucideStore, LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
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
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenues.execute.mockReset().mockReturnValue(of([venue]));
    getVenueOverview.execute.mockReset().mockReturnValue(of(venue));
    updateVenue.execute.mockReset().mockReturnValue(of(venue));
    getFileUrl.execute.mockReset().mockReturnValue(of('https://cdn.goat.test/venue.png'));
    uploadVenueImage.execute.mockReset().mockReturnValue(of('temp/venues/owner/new.png'));
    notify.success.mockReset(); notify.error.mockReset(); notify.warning.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerVenueManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideAlertCircle, LucideChevronRight, LucideCircleCheck, LucideClipboardCheck, LucideImage,
          LucideInbox, LucideMapPin, LucideReceipt, LucideSave, LucideStar, LucideStore, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getMyVenues },
        { provide: GetOwnerVenueOverviewUseCase, useValue: getVenueOverview },
        { provide: UpdateOwnerVenueUseCase, useValue: updateVenue },
        { provide: GetStorageFileUrlUseCase, useValue: getFileUrl },
        { provide: UploadVenueImageUseCase, useValue: uploadVenueImage },
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
    expect(fixture.nativeElement.querySelector('.image-card.is-primary .image-card__primary')?.textContent)
      .toContain('Ảnh đại diện');
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
    expect(component.images()[0].key).toBe('venues/owner/second.png');
    expect(component.isPrimaryImage(component.images()[0])).toBe(true);
    expect(component.form.pristine).toBe(true);
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
