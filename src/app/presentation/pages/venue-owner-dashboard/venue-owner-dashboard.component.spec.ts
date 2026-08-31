import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity,
  LucideAlertTriangle,
  LucideArrowRight,
  LucideBan,
  LucideCalendar,
  LucideCheck,
  LucideCircleCheck,
  LucideClipboardCheck,
  LucideClock,
  LucideCreditCard,
  LucideFilePlus2,
  LucideFileText,
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
  LucideUserRound,
  LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { BusinessType, OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { VenueOwnerDashboardComponent } from './venue-owner-dashboard.component';

describe('VenueOwnerDashboardComponent', () => {
  const getApplications = { execute: vi.fn() };
  const getVenues = { execute: vi.fn() };
  const primaryVenue = createVenue({
    venueId: 'venue-primary',
    name: 'GOAT Arena',
    active: true,
    averageRating: 4.8,
    totalReviews: 12,
    courts: [
      createCourt('court-1', 'venue-primary', true),
      createCourt('court-2', 'venue-primary', false)
    ]
  });
  const secondaryVenue = createVenue({
    venueId: 'venue-secondary',
    name: 'GOAT Riverside',
    active: false,
    averageRating: 3.6,
    totalReviews: 8,
    courts: [createCourt('court-3', 'venue-secondary', false)]
  });

  beforeEach(async () => {
    getApplications.execute.mockReset();
    getVenues.execute.mockReset().mockReturnValue(of([primaryVenue]));

    await TestBed.configureTestingModule({
      imports: [VenueOwnerDashboardComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideActivity,
          LucideAlertTriangle,
          LucideArrowRight,
          LucideBan,
          LucideCalendar,
          LucideCheck,
          LucideCircleCheck,
          LucideClipboardCheck,
          LucideClock,
          LucideCreditCard,
          LucideFilePlus2,
          LucideFileText,
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
          LucideUserRound,
          LucideX
        ),
        { provide: GetMyOwnerApplicationsUseCase, useValue: getApplications },
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues }
      ]
    }).compileComponents();
  });

  it('tổng hợp danh mục nhiều cơ sở thật và chỉ hiển thị hồ sơ mới nhất', () => {
    const older = createApplication('application-old', 'Cơ sở cũ', 'venue-primary', '2026-08-20T08:00:00Z');
    const latest = createApplication('application-new', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z');
    getApplications.execute.mockReturnValue(of(pageOf([older, latest])));
    getVenues.execute.mockReturnValue(of([primaryVenue, secondaryVenue]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.componentRef.setInput('ownerName', 'Minh Đạt');
    fixture.detectChanges();

    const metrics = metricMap(fixture.nativeElement);
    expect(fixture.nativeElement.textContent).toContain('Xin chào, Minh Đạt!');
    expect(fixture.nativeElement.querySelectorAll('.application-card')).toHaveLength(1);
    expect(metrics.get('Cơ sở quản lý')).toEqual({ value: '2', description: '1 đang hoạt động' });
    expect(metrics.get('Tổng sân thi đấu')).toEqual({ value: '3', description: '2 cơ sở · 1 chưa kích hoạt' });
    expect(metrics.get('Sân đang hoạt động')).toEqual({ value: '1', description: '2 sân tạm ngưng' });
    expect(metrics.get('Điểm đánh giá')).toEqual({ value: '4.3', description: '20 lượt đánh giá' });
    expect(fixture.nativeElement.querySelectorAll('.venue-switcher button')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('a.feature-card')).toHaveLength(7);
    expect(fixture.nativeElement.querySelector('.owner-hero__action').getAttribute('href')).toBe('/admin/check-in');
    expect(getVenues.execute).toHaveBeenCalledTimes(1);

    const secondVenueButton = fixture.nativeElement.querySelectorAll('.venue-switcher button')[1] as HTMLButtonElement;
    secondVenueButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.venue-identity h3').textContent).toContain('GOAT Riverside');
    expect(fixture.nativeElement.textContent).not.toContain('Đang phát triển');
  });

  it('khóa công cụ khi hồ sơ chưa được duyệt và không gọi Venue Service', () => {
    const pending = createApplication('application-pending', 'GOAT Pending', undefined, '2026-08-28T08:00:00Z', OwnerApplicationStatus.PENDING);
    getApplications.execute.mockReturnValue(of(pageOf([pending])));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.feature-card--locked')).toHaveLength(7);
    expect(fixture.nativeElement.querySelectorAll('a.feature-card')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.owner-workbench--application-only')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Chờ duyệt hồ sơ để mở khóa vận hành');
    expect(getVenues.execute).not.toHaveBeenCalled();
  });

  it('phân biệt danh mục hợp lệ đang trống với lỗi provider và giữ công cụ bị khóa', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Empty', undefined, '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    const metrics = metricMap(fixture.nativeElement);
    expect(metrics.get('Cơ sở quản lý')?.value).toBe('0');
    expect(metrics.get('Tổng sân thi đấu')?.value).toBe('0');
    expect(metrics.get('Điểm đánh giá')?.value).toBe('Chưa có');
    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở được liên kết');
    expect(fixture.nativeElement.textContent).toContain('Chưa có cơ sở được liên kết với tài khoản');
    expect(fixture.nativeElement.querySelectorAll('.feature-card--locked')).toHaveLength(7);
  });

  it('hiển thị trạng thái inactive và đưa ra hành động kích hoạt phù hợp', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Riverside', 'venue-secondary', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValue(of([secondaryVenue]));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(metricMap(fixture.nativeElement).get('Cơ sở quản lý')).toEqual({ value: '1', description: '0 đang hoạt động' });
    expect(fixture.nativeElement.textContent).toContain('Chưa kích hoạt');
    expect(fixture.nativeElement.querySelector('.owner-hero__action').textContent).toContain('Kích hoạt cơ sở');
    expect(fixture.nativeElement.querySelector('.owner-hero__action').getAttribute('href')).toBe('/admin/venues');
    expect(fixture.nativeElement.querySelectorAll('a.feature-card')).toHaveLength(7);
  });

  it('không biến lỗi Venue Service thành số 0, hỗ trợ retry và chặn double submit', () => {
    getApplications.execute.mockReturnValue(of(pageOf([
      createApplication('application-approved', 'GOAT Arena', 'venue-primary', '2026-08-28T08:00:00Z')
    ])));
    getVenues.execute.mockReturnValueOnce(throwError(() => new Error('provider down')));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect([...metricMap(fixture.nativeElement).values()].every(metric => metric.value === '—')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Venue Service chưa trả về được danh mục cơ sở.');
    expect(fixture.nativeElement.textContent).toContain('Chưa thể xác minh quyền quản lý cơ sở');

    const retryResponse = new Subject<OwnerVenueOverview[]>();
    getVenues.execute.mockReturnValue(retryResponse);
    fixture.componentInstance.retryVenues();
    fixture.componentInstance.retryVenues();
    expect(getVenues.execute).toHaveBeenCalledTimes(2);

    retryResponse.next([primaryVenue]);
    retryResponse.complete();
    fixture.detectChanges();
    expect(metricMap(fixture.nativeElement).get('Cơ sở quản lý')?.value).toBe('1');
    expect(fixture.nativeElement.querySelectorAll('a.feature-card')).toHaveLength(7);
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

  it('giữ weather widget dùng chung và chuyển tiếp sự kiện retry', () => {
    getApplications.execute.mockReturnValue(of(pageOf([])));
    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    const retrySpy = vi.fn();
    fixture.componentInstance.retryWeather.subscribe(retrySpy);
    fixture.componentRef.setInput('weatherError', 'Weather provider unavailable');
    fixture.detectChanges();

    const retryButton = fixture.nativeElement.querySelector('.weather-error button') as HTMLButtonElement;
    retryButton.click();
    expect(retrySpy).toHaveBeenCalledTimes(1);
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

function createCourt(id: string, venueId: string, active: boolean) {
  return {
    venueCourtId: id,
    venueId,
    name: `Sân ${id}`,
    sportType: 'FOOTBALL',
    capacity: 14,
    surfaceType: 'Cỏ nhân tạo',
    active
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
    fullName: 'Minh Đạt',
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

function metricMap(root: HTMLElement): Map<string, { value: string; description: string }> {
  return new Map([...root.querySelectorAll('.metric-rail__item')].map(item => [
    item.querySelector('.metric-rail__copy > span')?.textContent?.trim() ?? '',
    {
      value: item.querySelector('strong')?.textContent?.trim() ?? '',
      description: item.querySelector('small')?.textContent?.trim() ?? ''
    }
  ]));
}

function pageOf(result: OwnerApplication[]) {
  return { meta: { page: 0, pageSize: 20, pages: 1, total: result.length }, result };
}
