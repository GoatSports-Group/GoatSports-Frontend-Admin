import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity, LucideAlertCircle, LucideAlertTriangle, LucideArrowRight, LucideBan,
  LucideCalendar, LucideCheck, LucideCheckCircle, LucideChevronDown, LucideChevronLeft,
  LucideChevronRight, LucideClock, LucideConstruction, LucideFilePlus2, LucideFilter,
  LucideFolderOpen, LucideGripVertical, LucideInbox, LucideInfo, LucideLandPlot,
  LucideLayoutGrid, LucideMoreVertical, LucidePencil, LucidePlus, LucideReceipt,
  LucideRotateCcw, LucideSave, LucideSearch, LucideStore, LucideSun, LucideTable,
  LucideTrash2, LucideUsers, LucideX, provideLucideIcons
} from '@lucide/angular';
import { OwnerVenueCourt, OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
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
  const manageBookings = { list: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenues.execute.mockReset().mockReturnValue(of([venue]));
    manageCourts.list.mockReset().mockReturnValue(of([]));
    manageCourts.create.mockReset().mockReturnValue(of(savedCourt));
    manageCourts.update.mockReset().mockReturnValue(of(savedCourt));
    manageCourts.toggle.mockReset().mockReturnValue(of(savedCourt));
    manageBookings.list.mockReset().mockReturnValue(of({ items: [], page: 0, pageSize: 200, pages: 0, total: 0 }));
    notify.success.mockReset(); notify.error.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerCourtManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideActivity, LucideAlertCircle, LucideAlertTriangle, LucideArrowRight, LucideBan,
          LucideCalendar, LucideCheck, LucideCheckCircle, LucideChevronDown, LucideChevronLeft,
          LucideChevronRight, LucideClock, LucideConstruction, LucideFilePlus2, LucideFilter,
          LucideFolderOpen, LucideGripVertical, LucideInbox, LucideInfo, LucideLandPlot,
          LucideLayoutGrid, LucideMoreVertical, LucidePencil, LucidePlus, LucideReceipt,
          LucideRotateCcw, LucideSave, LucideSearch, LucideStore, LucideSun, LucideTable,
          LucideTrash2, LucideUsers, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getMyVenues },
        { provide: ManageOwnerVenueCourtsUseCase, useValue: manageCourts },
        { provide: ManageOwnerBookingsUseCase, useValue: manageBookings },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('không tải danh sách court khi owner chưa có Venue', () => {
    getMyVenues.execute.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    expect(manageCourts.list).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở để bố trí sân');
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

  it('dựng facility map từ dữ liệu sân thật và mở drawer mà không rời sơ đồ', () => {
    const maintenanceCourt: OwnerVenueCourt = {
      ...savedCourt,
      venueCourtId: 'court-2',
      name: 'Sân 02',
      sportType: 'FOOTBALL',
      availabilityStatus: 'MAINTENANCE'
    };
    manageCourts.list.mockReturnValue(of([savedCourt, maintenanceCourt]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();

    expect(manageBookings.list).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'venue-1' }));
    expect(fixture.nativeElement.querySelectorAll('.workspace-tabs button')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.court-object')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.facility-object')).toHaveLength(8);

    fixture.componentInstance.selectCourt(savedCourt);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.court-detail')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.facility-canvas')).toBeTruthy();
  });

  it('hỗ trợ chỉnh bố cục, hoàn tác và lưu theo cơ sở', () => {
    manageCourts.list.mockReturnValue(of([savedCourt]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.enterLayoutMode();
    const initialItemCount = component.draftLayout()!.items.length;
    component.addFacility('CAFE');
    expect(component.layoutMode()).toBe(true);
    expect(component.layoutDirty()).toBe(true);
    expect(component.draftLayout()!.items).toHaveLength(initialItemCount + 1);

    component.undoLayout();
    expect(component.draftLayout()!.items).toHaveLength(initialItemCount);
    component.saveLayout();
    expect(component.layoutMode()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith('Bố cục cơ sở đã được lưu trên thiết bị này.');
  });
});
