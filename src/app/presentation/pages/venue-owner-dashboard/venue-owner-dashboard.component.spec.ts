import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
  LucideConstruction,
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
import { GetOwnerVenueOverviewUseCase } from '@application/usecase/venue-owner-dashboard/get-owner-venue-overview.usecase';
import { VenueOwnerDashboardComponent } from './venue-owner-dashboard.component';

describe('VenueOwnerDashboardComponent', () => {
  const getApplications = { execute: vi.fn() };
  const getVenueOverview = { execute: vi.fn() };
  const venue: OwnerVenueOverview = {
    venueId: 'venue-new',
    name: 'GOAT Arena',
    description: 'Cụm sân thể thao trung tâm',
    openTime: '06:00:00',
    closeTime: '22:00:00',
    active: true,
    averageRating: 4.8,
    totalReviews: 12,
    phone: '0909000000',
    email: 'owner@goat.vn',
    address: '1 Goat Street',
    city: 'Hồ Chí Minh',
    imageUrls: [],
    amenities: ['Bãi đỗ xe', 'Phòng thay đồ'],
    courts: [
      { venueCourtId: 'court-1', venueId: 'venue-new', name: 'Sân 1', sportType: 'FOOTBALL', capacity: 14, surfaceType: 'Cỏ nhân tạo', active: true },
      { venueCourtId: 'court-2', venueId: 'venue-new', name: 'Sân 2', sportType: 'BADMINTON', capacity: 4, surfaceType: 'Thảm PVC', active: false }
    ]
  };

  beforeEach(async () => {
    getApplications.execute.mockReset();
    getVenueOverview.execute.mockReset().mockReturnValue(of(venue));

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
          LucideConstruction,
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
        { provide: GetOwnerVenueOverviewUseCase, useValue: getVenueOverview }
      ]
    }).compileComponents();
  });

  it('chỉ tóm tắt hồ sơ mới nhất và hiển thị chỉ số Venue thật sau khi được duyệt', () => {
    const older = createApplication('application-old', 'Cơ sở cũ', 'venue-old', '2026-08-20T08:00:00Z');
    const latest = createApplication('application-new', 'GOAT Arena', 'venue-new', '2026-08-28T08:00:00Z');
    getApplications.execute.mockReturnValue(of(pageOf([older, latest])));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.componentRef.setInput('ownerName', 'Minh Đạt');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Xin chào, Minh Đạt!');
    expect(fixture.nativeElement.querySelectorAll('.application-card')).toHaveLength(1);
    expect(text).toContain('GOAT Arena');
    expect(text).not.toContain('Cơ sở cũ');
    expect(text).toContain('Tổng sân thi đấu');
    expect(text).toContain('Sân đang hoạt động');
    expect(fixture.nativeElement.querySelectorAll('.metric-rail__item')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.owner-workbench app-owner-venue-overview')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.application-card--compact')).toBeTruthy();
    expect(getVenueOverview.execute).toHaveBeenCalledWith('venue-new');
  });

  it('khóa công cụ cơ sở và sân khi hồ sơ chưa được duyệt', () => {
    const pending = createApplication('application-pending', 'GOAT Pending', undefined, '2026-08-28T08:00:00Z', OwnerApplicationStatus.PENDING);
    getApplications.execute.mockReturnValue(of(pageOf([pending])));

    const fixture = TestBed.createComponent(VenueOwnerDashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.feature-card--locked')).toHaveLength(5);
    expect(fixture.nativeElement.querySelectorAll('a.feature-card')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.application-summary .section-link')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.owner-workbench--application-only')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Chờ duyệt để mở khóa vận hành');
    expect(getVenueOverview.execute).not.toHaveBeenCalled();
  });
});

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
      city: 'Hồ Chí Minh',
      province: 'Hồ Chí Minh'
    },
    documents: []
  };
}

function pageOf(result: OwnerApplication[]) {
  return { meta: { page: 0, pageSize: 20, pages: 1, total: result.length }, result };
}
