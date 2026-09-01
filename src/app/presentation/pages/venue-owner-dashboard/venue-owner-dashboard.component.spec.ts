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
  const manageBookings = { list: vi.fn() };
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
    expect(root.querySelector('.alerts-panel')).toBeTruthy();
    expect(root.querySelectorAll('.live-courts-list article')).toHaveLength(3);
    expect(root.querySelector('.venue-chip')?.textContent).toContain('GOAT Arena');
    expect(getVenues.execute).toHaveBeenCalledTimes(1);
  });

  it('tính KPI và biểu đồ từ dữ liệu doanh thu tháng cùng trạng thái sân thật', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getRevenue.execute.mockReturnValue(of(revenueReport({
      currentPeriod: {
        fromDate: '2026-09-01', toDate: '2026-09-30', bookingCount: 8,
        paidBookingCount: 6, totalRevenue: 1_870_000
      },
      revenueChangePercentage: 28.6,
      bookingCountChangePercentage: 12.7,
      dailyRevenue: [
        { date: '2026-09-01', revenue: 200_000, succeededPaymentCount: 1 },
        { date: '2026-09-02', revenue: 620_000, succeededPaymentCount: 2 },
        { date: '2026-09-03', revenue: 1_050_000, succeededPaymentCount: 3 }
      ]
    })));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    const metrics = kpiMap(fixture.nativeElement);
    expect(metrics.get('Doanh thu tháng')?.value).toContain('1.870.000');
    expect(metrics.get('Tổng lượt đặt')?.value).toBe('8');
    expect(metrics.get('Booking đã thanh toán')?.value).toBe('6');
    expect(metrics.get('Tỷ lệ sử dụng sân')?.value).toBe('50%');
    expect(fixture.nativeElement.querySelectorAll('.revenue-chart circle')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.utilization-ring strong')?.textContent).toContain('50%');
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
        fromDate: '2026-09-01',
        toDate: '2026-09-30'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('giữ nhãn trục biểu đồ tháng dễ đọc', () => {
    getApplications.execute.mockReturnValue(of(pageOf([])));
    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    const component = fixture.componentInstance;

    expect(Array.from({ length: 30 }, (_, index) => component.showRevenueAxisLabel(index, 30))
      .filter(Boolean)).toHaveLength(6);
    expect(component.showRevenueAxisLabel(0, 30)).toBe(true);
    expect(component.showRevenueAxisLabel(29, 30)).toBe(true);
    expect(component.showRevenueAxisLabel(1, 30)).toBe(false);
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
