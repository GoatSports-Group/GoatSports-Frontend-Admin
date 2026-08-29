import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideImage, LucideInbox, LucideMapPin,
  LucideReceipt, LucideSave, LucideStore, provideLucideIcons
} from '@lucide/angular';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venue.usecase';
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
  const getMyVenue = { execute: vi.fn() };
  const updateVenue = { execute: vi.fn() };
  const getFileUrl = { execute: vi.fn() };
  const uploadVenueImage = { execute: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenue.execute.mockReset().mockReturnValue(of(venue));
    updateVenue.execute.mockReset().mockReturnValue(of(venue));
    getFileUrl.execute.mockReset().mockReturnValue(of('https://cdn.goat.test/venue.png'));
    uploadVenueImage.execute.mockReset().mockReturnValue(of('temp/venues/owner/new.png'));
    notify.success.mockReset(); notify.error.mockReset(); notify.warning.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerVenueManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(LucideAlertCircle, LucideImage, LucideInbox, LucideMapPin, LucideReceipt, LucideSave, LucideStore),
        { provide: GetMyOwnerVenueUseCase, useValue: getMyVenue },
        { provide: UpdateOwnerVenueUseCase, useValue: updateVenue },
        { provide: GetStorageFileUrlUseCase, useValue: getFileUrl },
        { provide: UploadVenueImageUseCase, useValue: uploadVenueImage },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('hiển thị empty state thật khi owner chưa có Venue', () => {
    getMyVenue.execute.mockReturnValue(of(null));
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
    getMyVenue.execute.mockReturnValue(of({ ...venue, imageUrls: ['venues/owner/old.png'] }));
    const fixture = TestBed.createComponent(OwnerVenueManagementComponent);
    fixture.detectChanges();

    expect(getFileUrl.execute).toHaveBeenCalledWith('venues/owner/old.png');
    expect(fixture.nativeElement.querySelector('.image-card img')?.src)
      .toBe('https://cdn.goat.test/venue.png');
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
});
