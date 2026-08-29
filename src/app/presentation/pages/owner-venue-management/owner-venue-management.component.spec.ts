import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideImage, LucideInbox, LucideMapPin,
  LucideReceipt, LucideSave, LucideStore, provideLucideIcons
} from '@lucide/angular';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venue.usecase';
import { UpdateOwnerVenueUseCase } from '@application/usecase/venue-owner-dashboard/update-owner-venue.usecase';
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
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenue.execute.mockReset().mockReturnValue(of(venue));
    updateVenue.execute.mockReset().mockReturnValue(of(venue));
    notify.success.mockReset(); notify.error.mockReset(); notify.warning.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerVenueManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(LucideAlertCircle, LucideImage, LucideInbox, LucideMapPin, LucideReceipt, LucideSave, LucideStore),
        { provide: GetMyOwnerVenueUseCase, useValue: getMyVenue },
        { provide: UpdateOwnerVenueUseCase, useValue: updateVenue },
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
});
