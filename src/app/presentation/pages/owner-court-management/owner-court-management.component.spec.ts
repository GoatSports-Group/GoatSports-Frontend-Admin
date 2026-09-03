import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity, LucideAlertCircle, LucideAlertTriangle, LucideArrowRight, LucideBan,
  LucideCalendar, LucideCar, LucideCheck, LucideCheckCircle, LucideChevronDown, LucideChevronLeft,
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
import { ManageOwnerVenueFacilityLayoutUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-facility-layout.usecase';
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
  const manageFacilityLayout = { get: vi.fn(), save: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    getMyVenues.execute.mockReset().mockReturnValue(of([venue]));
    manageCourts.list.mockReset().mockReturnValue(of([]));
    manageCourts.create.mockReset().mockReturnValue(of(savedCourt));
    manageCourts.update.mockReset().mockReturnValue(of(savedCourt));
    manageCourts.toggle.mockReset().mockReturnValue(of(savedCourt));
    manageBookings.list.mockReset().mockReturnValue(of({ items: [], page: 0, pageSize: 20, pages: 0, total: 0 }));
    manageFacilityLayout.get.mockReset().mockReturnValue(of(null));
    manageFacilityLayout.save.mockReset().mockImplementation((venueId, request) => of({
      version: 1,
      venueId,
      ...request,
      updatedAt: '2026-09-03T10:00:00'
    }));
    notify.success.mockReset(); notify.error.mockReset();
    await TestBed.configureTestingModule({
      imports: [OwnerCourtManagementComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideActivity, LucideAlertCircle, LucideAlertTriangle, LucideArrowRight, LucideBan,
          LucideCalendar, LucideCar, LucideCheck, LucideCheckCircle, LucideChevronDown, LucideChevronLeft,
          LucideChevronRight, LucideClock, LucideConstruction, LucideFilePlus2, LucideFilter,
          LucideFolderOpen, LucideGripVertical, LucideInbox, LucideInfo, LucideLandPlot,
          LucideLayoutGrid, LucideMoreVertical, LucidePencil, LucidePlus, LucideReceipt,
          LucideDroplets, LucideRotateCcw, LucideSave, LucideSearch, LucideStore, LucideSun, LucideTable,
          LucideTrash2, LucideUsers, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getMyVenues },
        { provide: ManageOwnerVenueCourtsUseCase, useValue: manageCourts },
        { provide: ManageOwnerBookingsUseCase, useValue: manageBookings },
        { provide: ManageOwnerVenueFacilityLayoutUseCase, useValue: manageFacilityLayout },
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
    expect(fixture.nativeElement.querySelectorAll('.facility-zone-border')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.parking-slots i')).toHaveLength(23);
    expect(fixture.nativeElement.querySelectorAll('.parking-slots lucide-icon')).toHaveLength(23);
    expect(fixture.nativeElement.querySelector('.facility-furniture')).toBeNull();
    expect(fixture.nativeElement.querySelector('.court-detail')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.court-detail h2')?.textContent).toContain('Sân 01');
    expect(fixture.nativeElement.querySelector('.court-detail > header > button[aria-label="Đóng chi tiết sân"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.court-detail__identity > button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.booking-now--empty lucide-icon')).toBeNull();
    expect(fixture.nativeElement.querySelector('.booking-now--empty span')).toBeNull();
    expect(fixture.nativeElement.querySelector('.booking-now--empty strong')?.textContent.trim()).toBe('Không có lượt đang diễn ra');
    expect(fixture.nativeElement.querySelectorAll('.court-detail .quick-actions a, .court-detail .quick-actions button')).toHaveLength(8);
    expect(fixture.nativeElement.querySelector('.court-detail .daily-bookings h3')?.textContent).toContain('Lịch theo ngày');
    expect(fixture.nativeElement.querySelector('.court-detail .next-booking')).toBeNull();
    expect(fixture.nativeElement.querySelector('.court-detail .today-schedule')).toBeNull();

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
    expect(manageFacilityLayout.save).toHaveBeenCalledWith('venue-1', expect.objectContaining({
      items: expect.any(Array), zones: expect.any(Array)
    }));
    expect(component.layoutMode()).toBe(false);
    expect(component.panelMode()).toBe('DETAIL');
    expect(component.selectedCourtId()).toBe('court-1');
    expect(notify.success).toHaveBeenCalledWith('Bố cục cơ sở đã được lưu vào hệ thống.');
  });

  it('tải bố cục đã lưu từ API thay vì bộ nhớ trình duyệt', () => {
    manageCourts.list.mockReturnValue(of([savedCourt]));
    manageFacilityLayout.get.mockReturnValue(of({
      version: 1,
      venueId: 'venue-1',
      updatedAt: '2026-09-03T10:00:00',
      zones: [{ id: 'zone-a', name: 'KHU A', x: 0, y: 0, width: 700, height: 500 }],
      items: [{
        id: 'custom:medical', type: 'CUSTOM', label: 'Phòng y tế', icon: 'users',
        x: 520, y: 360, width: 180, height: 90, rotation: 0, zoneId: 'zone-a'
      }]
    }));

    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();

    expect(manageFacilityLayout.get).toHaveBeenCalledWith('venue-1');
    const component = fixture.componentInstance;
    expect(component.layout()!.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'custom:medical', label: 'Phòng y tế' })
    ]));
    expect(component.layout()!.items.some(item => item.courtId === 'court-1')).toBe(false);

    component.enterLayoutMode();
    fixture.detectChanges();
    expect(component.unplacedCourts()).toEqual([savedCourt]);
    const unplacedCard = fixture.nativeElement.querySelector('.unplaced-courts') as HTMLElement;
    const objectLibrary = fixture.nativeElement.querySelector('.object-library') as HTMLElement;
    expect(unplacedCard.textContent).toContain('Cầu lông');
    expect(unplacedCard.parentElement).toBe(objectLibrary.parentElement);
    expect([...unplacedCard.parentElement!.children].indexOf(unplacedCard))
      .toBeLessThan([...objectLibrary.parentElement!.children].indexOf(objectLibrary));

    component.placeUnplacedCourt(savedCourt, 780, 80);
    expect(component.unplacedCourts()).toHaveLength(0);
    expect(component.draftLayout()!.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'COURT', courtId: 'court-1', x: 780, y: 80 })
    ]));
  });

  it('tạo đối tượng tùy chỉnh với tên, icon và kích thước do chủ sân chọn', () => {
    manageCourts.list.mockReturnValue(of([savedCourt]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.enterLayoutMode();

    component.openCustomObjectCreator(520, 360);
    component.customObjectForm.setValue({ name: 'Phòng y tế', icon: 'users', width: 180, height: 90 });
    component.createCustomObject();

    const custom = component.draftLayout()!.items.at(-1)!;
    expect(custom).toEqual(expect.objectContaining({
      type: 'CUSTOM', label: 'Phòng y tế', icon: 'users', x: 520, y: 360, width: 180, height: 90
    }));
    expect(component.customObjectDialogOpen()).toBe(false);
    expect(component.layoutDirty()).toBe(true);
  });

  it('thêm khu ở phần canvas mở rộng và cho phép kéo, thay đổi kích thước khu', () => {
    manageCourts.list.mockReturnValue(of([savedCourt]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.enterLayoutMode();

    component.addZone();
    fixture.detectChanges();

    const zone = component.selectedLayoutZone();
    expect(zone).toBeTruthy();
    expect(component.draftLayout()!.zones).toHaveLength(3);
    expect(component.canvasWidth()).toBeGreaterThan(component.baseCanvasWidth);
    expect(fixture.nativeElement.querySelectorAll('.facility-zone-border.is-selected .zone-resize-handle')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.zone-resize-handle--width')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.zone-resize-handle--height')).toBeTruthy();
    const canvas = fixture.nativeElement.querySelector('.facility-canvas') as HTMLElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 1200, height: 700 } as DOMRect);

    const initialX = zone!.x;
    component.beginZonePointerOperation({
      button: 0, clientX: 0, clientY: 0, preventDefault: vi.fn(), stopPropagation: vi.fn()
    } as unknown as PointerEvent, zone!, 'MOVE');
    component.handlePointerMove({ clientX: 20, clientY: 0 } as PointerEvent);
    component.handlePointerUp();
    expect(component.selectedLayoutZone()!.x).toBeGreaterThan(initialX);

    const movedZone = component.selectedLayoutZone()!;
    const initialWidth = movedZone.width;
    const initialHeight = movedZone.height;
    component.beginZonePointerOperation({
      button: 0, clientX: 0, clientY: 0, preventDefault: vi.fn(), stopPropagation: vi.fn()
    } as unknown as PointerEvent, movedZone, 'RESIZE', 'X');
    component.handlePointerMove({ clientX: 20, clientY: 20 } as PointerEvent);
    component.handlePointerUp();
    expect(component.selectedLayoutZone()!.width).toBeGreaterThan(initialWidth);
    expect(component.selectedLayoutZone()!.height).toBe(initialHeight);
    expect(component.layoutInteracting()).toBe(false);
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
      walkInCustomerName: `Khách ${page + 1}`,
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
    expect(fixture.nativeElement.querySelectorAll('.daily-bookings article')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.daily-bookings article > i')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.daily-bookings article > b')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.daily-bookings')?.textContent).toContain('Khách 1');
    expect(fixture.nativeElement.querySelector('.daily-bookings')?.textContent).toContain('Khách 2');
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

  it('mở date picker native khi nhấn vào toàn bộ bộ lọc ngày', () => {
    manageCourts.list.mockReturnValue(of([savedCourt]));
    const fixture = TestBed.createComponent(OwnerCourtManagementComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.booking-date-filter input') as HTMLInputElement;
    const showPicker = vi.fn();
    Object.defineProperty(input, 'showPicker', { configurable: true, value: showPicker });

    fixture.componentInstance.openBookingDatePicker(new MouseEvent('click'));

    expect(showPicker).toHaveBeenCalledOnce();
  });
});
