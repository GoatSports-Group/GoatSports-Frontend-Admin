import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertTriangle,
  LucideArrowLeft,
  LucideBan,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCircleCheck,
  LucideClock,
  LucideFilePlus2,
  LucideInfo,
  LucidePlus,
  LucideSearch,
  LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { BusinessType, OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { VenueOwnerApplicationsComponent } from './venue-owner-applications.component';

describe('VenueOwnerApplicationsComponent', () => {
  const approved = application({
    ownerApplicationId: 'approved-1',
    status: OwnerApplicationStatus.APPROVED,
    createdAt: '2026-08-29T16:31:00',
    receivedAt: '2026-08-29T16:32:00',
    viewedAt: '2026-08-29T16:33:00',
    reviewedAt: '2026-08-29T16:47:00'
  });
  const rejected = application({
    ownerApplicationId: 'rejected-1',
    businessName: 'GOAT Riverside',
    status: OwnerApplicationStatus.REJECTED,
    rejectReason: 'Giấy phép kinh doanh chưa rõ thông tin.',
    createdAt: '2026-08-20T09:10:00',
    receivedAt: '2026-08-20T09:11:00',
    viewedAt: '2026-08-20T09:12:00',
    reviewedAt: '2026-08-20T10:15:00'
  });
  const getApplications = { execute: vi.fn() };
  const notify = { warning: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    getApplications.execute.mockReset().mockReturnValue(of({
      result: [rejected, approved],
      meta: { page: 0, pageSize: 100, pages: 1, total: 2 }
    }));
    notify.warning.mockReset();
    notify.error.mockReset();

    await TestBed.configureTestingModule({
      imports: [VenueOwnerApplicationsComponent],
      providers: [
        provideLucideIcons(
          LucideAlertTriangle,
          LucideArrowLeft,
          LucideBan,
          LucideCheck,
          LucideChevronLeft,
          LucideChevronRight,
          LucideCircleCheck,
          LucideClock,
          LucideFilePlus2,
          LucideInfo,
          LucidePlus,
          LucideSearch,
          LucideX
        ),
        { provide: GetMyOwnerApplicationsUseCase, useValue: getApplications },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('renders newest application first in a master-detail workspace', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.application-workspace')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.application-list__item')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.application-list__item.is-selected')?.textContent).toContain('29/08/2026');
    expect(fixture.nativeElement.querySelector('.application-detail')?.textContent).toContain('Đơn đăng ký đã được chấp nhận.');
  });

  it('changes the detail pane when another application is selected', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationsComponent);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.application-list__item') as NodeListOf<HTMLButtonElement>;
    items[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.application-detail')?.textContent).toContain('GOAT Riverside');
    expect(fixture.nativeElement.querySelector('.application-detail__rejection')?.textContent)
      .toContain('Giấy phép kinh doanh chưa rõ thông tin.');
  });

  it('filters the master list without losing the application detail contract', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.updateSearch('Riverside');
    fixture.detectChanges();

    expect(component.filteredApplications()).toEqual([rejected]);
    expect(fixture.nativeElement.querySelectorAll('.application-list__item')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.application-detail')?.textContent).toContain('GOAT Riverside');
  });
});

function application(overrides: Partial<OwnerApplication>): OwnerApplication {
  return {
    ownerApplicationId: 'application-1',
    userId: 'owner-1',
    fullName: 'Đạt Minh',
    phone: '0867684603',
    email: 'nguyenthangdat84@gmail.com',
    businessName: 'GOAT',
    businessType: BusinessType.INDIVIDUAL,
    taxCode: '0312345678',
    identityNumber: '079098123456',
    status: OwnerApplicationStatus.PENDING,
    address: {
      addressId: 'address-1',
      address: '25 Trần Phú',
      ward: 'Phường Lộc Thọ',
      district: 'Nha Trang',
      city: 'Khánh Hòa'
    },
    documents: [],
    ...overrides
  };
}
