import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity,
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideArrowRight,
  LucideBan,
  LucideBarChart3,
  LucideCalendar,
  LucideCalendarCheck,
  LucideCheck,
  LucideChevronDown,
  LucideChevronRight,
  LucideCircleCheck,
  LucideClipboardCheck,
  LucideClock,
  LucideCreditCard,
  LucideFilePlus2,
  LucideFileText,
  LucideGauge,
  LucideImage,
  LucideInfo,
  LucideLandPlot,
  LucideLayoutGrid,
  LucideLoader2,
  LucideMail,
  LucideMapPin,
  LucidePencil,
  LucidePhone,
  LucideRotateCcw,
  LucideShieldCheck,
  LucideSparkles,
  LucideStar,
  LucideStore,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideUserRound,
  LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { BusinessType, OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import { CourtAvailabilityStatus, OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerBookingsUseCase } from '@application/usecase/owner-booking/manage-owner-bookings.usecase';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { VenueOwnerDashboardComponent } from './venue-owner-dashboard.component';

describe('VenueOwnerDashboardComponent', () => {
  const getApplications = { execute: vi.fn() };
  const getVenues = { execute: vi.fn() };
  const manageBookings = { list: vi.fn(), detail: vi.fn() };
  const getRevenue = { execute: vi.fn() };
  const getFileUrl = { execute: vi.fn() };
  const primaryVenue = createVenue({
    venueId: 'venue-primary',
    name: 'GOAT Arena',
    active: true,
    courts: [
      createCourt('court-1', 'venue-primary', true, 'OCCUPIED'),
      createCourt('court-2', 'venue-primary', true, 'AVAILABLE')
    ]
  });
  const secondaryVenue = createVenue({
    venueId: 'venue-secondary',
    name: 'GOAT Riverside',
    active: false,
    courts: [createCourt('court-3', 'venue-secondary', false, 'INACTIVE')]
  });

  beforeEach(async () => {
    getApplications.execute.mockReset();
    getVenues.execute.mockReset().mockReturnValue(of([primaryVenue]));
    manageBookings.list.mockReset().mockReturnValue(of({
      items: [], page: 0, pageSize: 12, pages: 0, total: 0
    }));
    manageBookings.detail.mockReset().mockReturnValue(of(createBooking()));
    getFileUrl.execute.mockReset().mockReturnValue(of('https://cdn.goat.test/venue-cover.png'));
    getRevenue.execute.mockReset().mockReturnValue(of(revenueReport()));

    await TestBed.configureTestingModule({
      imports: [VenueOwnerDashboardComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideActivity,
          LucideAlertCircle,
          LucideAlertTriangle,
          LucideArrowRight,
          LucideBan,
          LucideBarChart3,
          LucideCalendar,
          LucideCalendarCheck,
          LucideCheck,
          LucideChevronDown,
          LucideChevronRight,
          LucideCircleCheck,
          LucideClipboardCheck,
          LucideClock,
          LucideCreditCard,
          LucideFilePlus2,
          LucideFileText,
          LucideGauge,
          LucideImage,
          LucideInfo,
          LucideLandPlot,
          LucideLayoutGrid,
          LucideLoader2,
          LucideMail,
          LucideMapPin,
          LucidePencil,
          LucidePhone,
          LucideRotateCcw,
          LucideShieldCheck,
          LucideSparkles,
          LucideStar,
          LucideStore,
          LucideTrendingDown,
          LucideTrendingUp,
          LucideUserRound,
          LucideX
        ),
        { provide: GetMyOwnerApplicationsUseCase, useValue: getApplications },
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues },
        { provide: ManageOwnerBookingsUseCase, useValue: manageBookings },
        { provide: GetOwnerRevenueUseCase, useValue: getRevenue },
        { provide: GetStorageFileUrlUseCase, useValue: getFileUrl }
      ]
    }).compileComponents();
  });

  it('hiển thị đầy đủ các khối vận hành theo layout dashboard mới', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([primaryVenue, secondaryVenue]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.componentRef.setInput('ownerName', 'Minh Tuấn');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Minh Tuấn');
    expect(root.querySelector('.performance-card')).toBeTruthy();
    expect(root.querySelectorAll('.kpi-strip article')).toHaveLength(4);
    expect(root.querySelector('.schedule-panel')).toBeTruthy();
    expect(root.querySelector('.live-courts-panel')).toBeTruthy();
    expect(root.querySelector('.reviews-preview')).toBeTruthy();
    expect(root.querySelector('.dev-badge')?.textContent).toContain('DEV');
    expect(root.querySelectorAll('.reviews-preview__list article')).toHaveLength(2);
    expect(root.querySelectorAll('.live-courts-list article')).toHaveLength(2);
    expect((root.querySelector('.venue-selector select') as HTMLSelectElement).value).toBe('venue-primary');
    expect(getVenues.execute).toHaveBeenCalledTimes(1);
  });

  it('tải lại toàn bộ thống kê theo venue được chọn', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([primaryVenue, secondaryVenue]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();
    getRevenue.execute.mockClear();
    manageBookings.list.mockClear();

    const venueSelect = fixture.nativeElement.querySelector('.venue-selector select') as HTMLSelectElement;
    venueSelect.value = 'venue-secondary';
    venueSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedVenueId()).toBe('venue-secondary');
    expect(getRevenue.execute).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'venue-secondary' }));
    expect(manageBookings.list).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'venue-secondary' }));
    expect(fixture.nativeElement.querySelectorAll('.live-courts-list article')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.live-courts-list article')?.dataset['status']).toBe('INACTIVE');
  });

  it('hiển thị doanh thu ngày, KPI tháng và trạng thái sân thật', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getRevenue.execute.mockReturnValue(of(revenueReport({
      currentPeriod: {
        fromDate: '2026-09-01', toDate: '2026-09-30', bookingCount: 8,
        paidBookingCount: 6, totalRevenue: 1_870_000
      },
      previousPeriod: {
        fromDate: '2026-08-01', toDate: '2026-08-31', bookingCount: 7,
        paidBookingCount: 5, totalRevenue: 1_454_000
      },
      revenueChangePercentage: 28.6,
      bookingCountChangePercentage: 12.7,
      dailyRevenue: [
        { date: '2026-09-01', revenue: 200_000, succeededPaymentCount: 1 },
        { date: '2026-09-02', revenue: 620_000, succeededPaymentCount: 2 },
        { date: '2026-09-03', revenue: 1_050_000, succeededPaymentCount: 3 }
      ],
      hourlyRevenue: [
        { hour: 8, revenue: 200_000, succeededPaymentCount: 1 },
        { hour: 12, revenue: 620_000, succeededPaymentCount: 2 },
        { hour: 18, revenue: 1_050_000, succeededPaymentCount: 3 }
      ]
    })));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    const metrics = kpiMap(fixture.nativeElement);
    expect(metrics.get('Doanh thu tháng hiện tại')?.value).toContain('1.870.000');
    expect(metrics.get('Tổng lượt đặt')?.value).toBe('8');
    expect(metrics.get('Khách hàng mới')?.value).toBe('0');
    expect(metrics.get('Tỷ lệ khách quay lại')?.value).toBe('0%');
    expect(fixture.nativeElement.querySelector('#revenue-today-title')?.textContent).toContain('1.870.000');
    expect(fixture.nativeElement.querySelectorAll('.daily-revenue-metrics article')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.daily-revenue-line')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.daily-revenue-axis')).toHaveLength(7);
    expect(fixture.nativeElement.querySelectorAll('.daily-revenue-money-axis')).toHaveLength(6);
    expect(fixture.nativeElement.querySelector('.daily-revenue-comparison')?.textContent).toContain('+28,6%');
    expect(fixture.nativeElement.querySelector('.daily-revenue-comparison')?.textContent).toContain('so với ngày trước');
    expect(fixture.nativeElement.querySelector('.utilization-ring strong')?.textContent).toContain('50%');
  });

  it('dựng line từ payment booking khi backend đang chạy chưa trả hourlyRevenue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 2, 12));
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getRevenue.execute.mockReturnValue(of(revenueReport({
      currentPeriod: {
        fromDate: '2026-09-02', toDate: '2026-09-02', bookingCount: 1,
        paidBookingCount: 1, totalRevenue: 180_000
      },
      previousPeriod: {
        fromDate: '2026-09-01', toDate: '2026-09-01', bookingCount: 1,
        paidBookingCount: 1, totalRevenue: 150_000
      },
      revenueChangePercentage: 20,
      hourlyRevenue: undefined
    })));
    const booking = createBooking({
      bookingId: 'booking-hourly-fallback', playDate: '2026-09-02', startTime: '10:00:00',
      payments: [{
        paymentId: 'payment-hourly-fallback', purpose: 'BOOKING_DEPOSIT', amount: 180_000,
        currency: 'VND', status: 'SUCCEEDED', paidAt: '2026-09-01T08:04:00Z',
        createdAt: '2026-09-01T08:01:00Z'
      }]
    });
    manageBookings.list.mockImplementation(filter => of(bookingPage(
      filter.fromDate === filter.toDate ? [booking] : []
    )));

    try {
      const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
      fixture.detectChanges();
      const points = fixture.componentInstance.dailyRevenueChartPoints();

      expect(points[0].cumulativeRevenue).toBe(0);
      expect(points[10].cumulativeRevenue).toBe(180_000);
      expect(points[10].y).toBeLessThan(points[0].y);
      expect(fixture.nativeElement.querySelector('.daily-revenue-callout')?.textContent).toContain('180.000đ');
      expect(fixture.nativeElement.querySelector('.daily-revenue-line')?.getAttribute('d')).toContain(' C ');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lấy URL ảnh đại diện từ storage-service thay vì bind trực tiếp object key', () => {
    const venueWithCover = createVenue({
      venueId: 'venue-with-cover',
      name: 'GOAT Cover Arena',
      imageUrls: ['venues/owner/cover.png']
    });
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Cover Arena', 'venue-with-cover', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([venueWithCover]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(getFileUrl.execute).toHaveBeenCalledOnce();
    expect(getFileUrl.execute).toHaveBeenCalledWith('venues/owner/cover.png');
    const image = fixture.nativeElement.querySelector('.venue-photo img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://cdn.goat.test/venue-cover.png');
    expect(image.getAttribute('src')).not.toBe('venues/owner/cover.png');
  });

  it('chỉ hiển thị tiến độ hồ sơ khi đơn chưa được duyệt và không gọi Venue Service', () => {
    const pending = createApplication(
      'application-pending', 'GOAT Pending', undefined, '2026-08-28T08:00:00Z', OwnerApplicationStatus.PENDING
    );
    getApplications.execute.mockReturnValue(of(pageOf([pending])));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.application-summary')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.performance-card')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Tiến độ đơn đăng ký');
    expect(getVenues.execute).not.toHaveBeenCalled();
  });

  it('phân biệt danh mục cơ sở hợp lệ đang trống với lỗi provider', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Empty', undefined, '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở được liên kết');
    expect(fixture.nativeElement.querySelector('.dashboard-state--error')).toBeNull();
    expect(fixture.nativeElement.querySelector('.performance-card')).toBeNull();
  });

  it('hiển thị đúng trạng thái live của sân inactive', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Riverside', 'venue-secondary', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([secondaryVenue]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    const court = fixture.nativeElement.querySelector('.live-courts-list article') as HTMLElement;
    expect(court.dataset['status']).toBe('INACTIVE');
    expect(court.textContent).toContain('Tạm ngưng');
    expect(fixture.nativeElement.querySelector('.utilization-ring strong')?.textContent).toContain('0%');
  });

  it('hiển thị lỗi Venue Service, hỗ trợ retry và chặn double submit', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValueOnce(throwError(() => new Error('provider down')));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dashboard-state--error')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Venue Service chưa trả về được danh mục cơ sở.');

    const retryResponse = new Subject<OwnerVenueOverview[]>();
    getVenues.execute.mockReturnValue(retryResponse);
    fixture.componentInstance.retryVenues();
    fixture.componentInstance.retryVenues();
    expect(getVenues.execute).toHaveBeenCalledTimes(2);

    retryResponse.next([primaryVenue]);
    retryResponse.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.performance-card')).toBeTruthy();
  });

  it('hiển thị lỗi hồ sơ và cho phép tải lại', () => {
    getApplications.execute
      .mockReturnValueOnce(throwError(() => new Error('auth unavailable')))
      .mockReturnValueOnce(of(pageOf([])));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Không thể tải tiến trình lúc này. Vui lòng thử lại.');

    const retryButton = fixture.nativeElement.querySelector('.history-state--error button') as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();
    expect(getApplications.execute).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).not.toContain('Không thể tải tiến trình lúc này. Vui lòng thử lại.');
  });

  it('giữ API weather tương thích với trang cha nhưng không lặp widget trong main', () => {
    getApplications.execute.mockReturnValue(of(pageOf([])));
    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.componentRef.setInput('weatherError', 'Weather provider unavailable');
    fixture.detectChanges();

    expect(fixture.componentInstance.weatherError()).toBe('Weather provider unavailable');
    expect(fixture.nativeElement.querySelector('app-weather-widget')).toBeNull();
  });

  it('tải snapshot doanh thu cho toàn bộ tháng hiện tại', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12));
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));

    try {
      TestBed.createComponent(VenueOwnerDashboardComponent);
      expect(getRevenue.execute).toHaveBeenCalledWith({
        venueId: 'venue-primary',
        fromDate: '2026-09-01',
        toDate: '2026-09-30'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('thống kê doanh thu đúng ngày người dùng lựa chọn', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 2, 12));
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));

    try {
      const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
      fixture.detectChanges();
      getRevenue.execute.mockClear();

      const input = fixture.nativeElement.querySelector('.revenue-actions input') as HTMLInputElement;
      input.value = '2026-09-01';
      input.dispatchEvent(new Event('change'));
      (fixture.nativeElement.querySelector('.revenue-actions button') as HTMLButtonElement).click();

      expect(getRevenue.execute).toHaveBeenCalledWith({
        venueId: 'venue-primary', fromDate: '2026-09-01', toDate: '2026-09-01'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('tính khách hàng mới và tỷ lệ quay lại so với tháng trước', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 2, 12));
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    manageBookings.list.mockImplementation(filter => {
      if (filter.size === 12) return of(bookingPage([]));
      const playersByMonth: Record<string, string[]> = {
        '2026-09-01': ['player-a', 'player-b'],
        '2026-08-01': ['player-a', 'player-c'],
        '2026-07-01': ['player-c']
      };
      return of(bookingPage((playersByMonth[filter.fromDate ?? ''] ?? []).map((playerId, index) =>
        createBooking({ bookingId: `${filter.fromDate}-${index}`, playerId })
      )));
    });

    try {
      const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
      fixture.detectChanges();
      const metrics = kpiMap(fixture.nativeElement);

      expect(metrics.get('Khách hàng mới')?.value).toBe('1');
      expect(metrics.get('Khách hàng mới')?.detail).toContain('0%');
      expect(metrics.get('Tỷ lệ khách quay lại')?.value).toBe('50%');
      expect(metrics.get('Tỷ lệ khách quay lại')?.detail).toContain('0 điểm');
    } finally {
      vi.useRealTimers();
    }
  });

  it('mở popup và tải chi tiết khi click một booking sắp tới', () => {
    const booking = createBooking({ bookingId: 'booking-detail-1', bookingCode: 'GS-DETAIL-1' });
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    manageBookings.list.mockImplementation(filter => of(bookingPage(filter.size === 12 ? [booking] : [])));
    manageBookings.detail.mockReturnValue(of(booking));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-row') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(manageBookings.detail).toHaveBeenCalledWith('booking-detail-1');
    const dialog = fixture.nativeElement.querySelector('.booking-detail-dialog') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('GS-DETAIL-1');
    expect(dialog.textContent).toContain('Lịch sử thanh toán');
  });
});

function createVenue(overrides: Partial<OwnerVenueOverview>): OwnerVenueOverview {
  return {
    venueId: 'venue-default',
    name: 'GOAT Venue',
    description: 'Cụm sân thể thao trung tâm',
    openTime: '06:00:00',
    closeTime: '22:00:00',
    active: true,
    averageRating: 4.5,
    totalReviews: 10,
    phone: '0909000000',
    email: 'owner@goat.vn',
    address: '1 Goat Street',
    city: 'Hồ Chí Minh',
    imageUrls: [],
    amenities: ['Bãi đỗ xe', 'Phòng thay đồ'],
    courts: [],
    ...overrides
  };
}

function createCourt(
  id: string,
  venueId: string,
  active: boolean,
  availabilityStatus?: CourtAvailabilityStatus
) {
  return {
    venueCourtId: id,
    venueId,
    name: `Sân ${id}`,
    sportType: 'FOOTBALL',
    capacity: 14,
    surfaceType: 'Cỏ nhân tạo',
    active,
    availabilityStatus
  };
}

function createBooking(overrides: Partial<OwnerBooking> = {}): OwnerBooking {
  return {
    bookingId: 'booking-1',
    playerId: 'player-1',
    venueId: 'venue-primary',
    venueCourtId: 'court-1',
    venueName: 'GOAT Arena',
    courtName: 'Sân bóng đá A',
    playDate: '2026-09-03',
    startTime: '17:00:00',
    endTime: '18:00:00',
    status: 'CONFIRMED',
    source: 'DIRECT',
    totalPrice: 180_000,
    depositAmount: 80_000,
    remainingAmount: 100_000,
    bookingCode: 'GS-BOOKING-1',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:05:00Z',
    payments: [{
      paymentId: 'payment-1', purpose: 'BOOKING_DEPOSIT', amount: 80_000,
      currency: 'VND', status: 'SUCCEEDED', paidAt: '2026-09-01T08:04:00Z',
      createdAt: '2026-09-01T08:01:00Z'
    }],
    allowedTransitions: ['CHECKED_IN', 'CANCELLED'],
    ...overrides
  };
}

function bookingPage(items: OwnerBooking[]) {
  return { items, page: 0, pageSize: 20, pages: items.length ? 1 : 0, total: items.length };
}

function createApplication(
  id: string,
  businessName: string,
  venueId: string | undefined,
  createdAt: string,
  status = OwnerApplicationStatus.APPROVED
): OwnerApplication {
  return {
    ownerApplicationId: id,
    venueId,
    userId: 'owner-1',
    fullName: 'Minh Tuấn',
    phone: '0909000000',
    email: 'owner@goat.vn',
    businessName,
    businessType: BusinessType.INDIVIDUAL,
    taxCode: 'TAX-01',
    identityNumber: '012345678901',
    status,
    createdAt,
    address: {
      addressId: `address-${id}`,
      address: '1 Goat Street',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'Hồ Chí Minh'
    },
    documents: []
  };
}

function revenueReport(overrides: Record<string, unknown> = {}) {
  return {
    scopeVenueId: null,
    currency: 'VND',
    periodBasis: 'BOOKING_PLAY_DATE' as const,
    currentPeriod: {
      fromDate: '2026-09-01', toDate: '2026-09-30', bookingCount: 0,
      paidBookingCount: 0, totalRevenue: 0
    },
    previousPeriod: {
      fromDate: '2026-08-01', toDate: '2026-08-31', bookingCount: 0,
      paidBookingCount: 0, totalRevenue: 0
    },
    revenueChangePercentage: null,
    bookingCountChangePercentage: null,
    paymentStatusBreakdown: [],
    dailyRevenue: [],
    hourlyRevenue: Array.from({ length: 24 }, (_, hour) => ({
      hour, revenue: 0, succeededPaymentCount: 0
    })),
    ...overrides
  };
}

function kpiMap(root: HTMLElement): Map<string, { value: string; detail: string }> {
  return new Map([...root.querySelectorAll('.kpi-strip article')].map(item => [
    item.querySelector('small')?.textContent?.trim() ?? '',
    {
      value: item.querySelector('strong')?.textContent?.trim() ?? '',
      detail: item.querySelector('em')?.textContent?.trim() ?? ''
    }
  ]));
}

function pageOf(result: OwnerApplication[]) {
  return { meta: { page: 0, pageSize: 20, pages: 1, total: result.length }, result };
}
