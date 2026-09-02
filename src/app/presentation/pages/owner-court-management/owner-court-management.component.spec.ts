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
  LucideDroplets, LucideRotateCcw, LucideSave, LucideSearch, LucideStore, LucideSun, LucideTable,
  LucideTrash2, LucideUsers, LucideX, provideLucideIcons
} from '@lucide/angular';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
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
    manageBookings.list.mockReset().mockReturnValue(of({ items: [], page: 0, pageSize: 20, pages: 0, total: 0 }));
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
          LucideDroplets, LucideRotateCcw, LucideSave, LucideSearch, LucideStore, LucideSun, LucideTable,
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

    expect(manageBookings.list).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'venue-1', page: 0, size: 20 }));
    expect(fixture.nativeElement.querySelectorAll('.workspace-tabs button')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.court-object')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.facility-object')).toHaveLength(9);
    expect(fixture.nativeElement.querySelector('.court-detail')).toBeTruthy();

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

  it('tải đủ booking theo ngày bằng các trang hợp lệ tối đa 20 phần tử', () => {
    manageBookings.list.mockImplementation(filter => of(filter.venueCourtId
      ? { items: [], page: 0, pageSize: 20, pages: 0, total: 0 }
      : {
          items: [{ bookingId: `booking-${filter.page}` }],
          page: filter.page,
          pageSize: 20,
          pages: 2,
          total: 2
        }));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();

    const venueRequests = manageBookings.list.mock.calls
      .map(([filter]) => filter)
      .filter(filter => !filter.venueCourtId);
    expect(venueRequests).toEqual([
      expect.objectContaining({ venueId: 'venue-1', page: 0, size: 20 }),
      expect.objectContaining({ venueId: 'venue-1', page: 1, size: 20 })
    ]);
    expect(fixture.componentInstance.bookings()).toHaveLength(2);
  });

  it('tải hết mọi trang booking của đúng sân được chọn trong ngày', () => {
    const booking = (page: number): OwnerBooking => ({
      bookingId: `court-booking-${page}`,
      venueId: 'venue-1',
      venueCourtId: 'court-1',
      venueName: 'Goat Arena',
      courtName: 'Sân 01',
      playDate: '2030-05-10',
      startTime: `${String(8 + page).padStart(2, '0')}:00:00`,
      endTime: `${String(9 + page).padStart(2, '0')}:00:00`,
      status: 'CONFIRMED',
      source: 'DIRECT',
      totalPrice: 100000,
      depositAmount: 0,
      remainingAmount: 100000,
      bookingCode: `BK-${page}`,
      createdAt: '2030-05-01T00:00:00Z',
      payments: [],
      allowedTransitions: []
    });
    manageCourts.list.mockReturnValue(of([savedCourt]));
    manageBookings.list.mockImplementation(filter => {
      if (!filter.venueCourtId) {
        return of({ items: [], page: 0, pageSize: 20, pages: 1, total: 0 });
      }
      return of({ items: [booking(filter.page)], page: filter.page, pageSize: 20, pages: 2, total: 2 });
    });

    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const courtRequests = manageBookings.list.mock.calls
      .map(([filter]) => filter)
      .filter(filter => filter.venueCourtId === 'court-1');
    expect(courtRequests).toEqual([
      expect.objectContaining({ venueId: 'venue-1', venueCourtId: 'court-1', page: 0, size: 20 }),
      expect.objectContaining({ venueId: 'venue-1', venueCourtId: 'court-1', page: 1, size: 20 })
    ]);
    expect(component.detailBookingsForCourt('court-1')).toHaveLength(2);
  });

  it('đổi ngày sẽ tải lại booking của cơ sở và sân đang mở theo đúng ngày', () => {
    manageCourts.list.mockReturnValue(of([savedCourt]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    manageBookings.list.mockClear();

    fixture.componentInstance.changeBookingDate({ target: { value: '2030-05-10' } } as unknown as Event);

    expect(manageBookings.list).toHaveBeenCalledWith(expect.objectContaining({
      venueId: 'venue-1', fromDate: '2030-05-10', toDate: '2030-05-10', page: 0, size: 20
    }));
    expect(manageBookings.list).toHaveBeenCalledWith(expect.objectContaining({
      venueId: 'venue-1', venueCourtId: 'court-1', fromDate: '2030-05-10', toDate: '2030-05-10', page: 0, size: 20
    }));
  });
});
