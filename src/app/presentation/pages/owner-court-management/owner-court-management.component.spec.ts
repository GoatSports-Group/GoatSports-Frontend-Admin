import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity, LucideAlertCircle, LucideBan, LucideCheck, LucideChevronDown,
  LucideChevronLeft, LucideChevronRight, LucideConstruction, LucideFilter,
  LucideInbox, LucideLandPlot, LucideMoreVertical, LucidePencil, LucidePlus,
  LucideSave, LucideSearch, LucideStore, LucideUsers, LucideX, provideLucideIcons
} from '@lucide/angular';
import { OwnerVenueCourt, OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OwnerCourtManagementComponent } from './owner-court-management.component';

describe('OwnerCourtManagementComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: false, address: '1 Goat Street',
    district: 'Quận 1', city: 'Hồ Chí Minh', imageUrls: [], amenities: [], courts: []
  };
  const savedCourt: OwnerVenueCourt = {
    venueCourtId: 'court-1', venueId: 'venue-1', name: 'Sân 01', sportType: 'BADMINTON',
    capacity: 4, surfaceType: 'Thảm PVC', active: true
  };
  const getMyVenues = { execute: vi.fn() };
  const manageCourts = { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), toggle: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenues.execute.mockReset().mockReturnValue(of([venue]));
    manageCourts.list.mockReset().mockReturnValue(of([]));
    manageCourts.create.mockReset().mockReturnValue(of(savedCourt));
    manageCourts.update.mockReset().mockReturnValue(of(savedCourt));
    manageCourts.toggle.mockReset().mockReturnValue(of(savedCourt));
    notify.success.mockReset(); notify.error.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerCourtManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideActivity, LucideAlertCircle, LucideBan, LucideCheck, LucideChevronDown,
          LucideChevronLeft, LucideChevronRight, LucideConstruction, LucideFilter,
          LucideInbox, LucideLandPlot, LucideMoreVertical, LucidePencil, LucidePlus,
          LucideSave, LucideSearch, LucideStore, LucideUsers, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getMyVenues },
        { provide: ManageOwnerVenueCourtsUseCase, useValue: manageCourts },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('không tải danh sách court khi owner chưa có Venue', () => {
    getMyVenues.execute.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    expect(manageCourts.list).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở để quản lý sân');
  });

  it('chặn double submit khi tạo court', () => {
    const pending = new Subject<OwnerVenueCourt>();
    manageCourts.create.mockReturnValue(pending);
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openCreate();
    component.form.setValue({ name: 'Sân 01', sportType: 'BADMINTON', capacity: 4, surfaceType: 'Thảm PVC', active: true });

    component.submit();
    component.submit();

    expect(manageCourts.create).toHaveBeenCalledOnce();
    expect(component.saving()).toBe(true);
    expect(component.form.disabled).toBe(true);
  });
});
