import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideActivity, LucideAlertCircle, LucideCalendar, LucideInfo, LucideLandPlot,
  LucidePencil, LucidePlus, LucideReceipt, LucideRotateCcw, LucideShieldOff,
  LucideTrash2, LucideX, provideLucideIcons
} from '@lucide/angular';
import { CourtPricingRule } from '@application/dto/owner-schedule/owner-schedule.dto';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { ManageOwnerScheduleUseCase } from '@application/usecase/owner-schedule/manage-owner-schedule.usecase';
import { GetMyOwnerVenuesUseCase } from '@application/usecase/venue-owner-dashboard/get-my-owner-venues.usecase';
import { ManageOwnerVenueCourtsUseCase } from '@application/usecase/venue-owner-dashboard/manage-owner-venue-courts.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OwnerScheduleComponent } from './owner-schedule.component';

describe('OwnerScheduleComponent', () => {
  const venue: OwnerVenueOverview = {
    venueId: 'venue-1', name: 'Goat Arena', active: true, openTime: '06:00:00', closeTime: '22:00:00',
    imageUrls: [], amenities: [], courts: []
  };
  const rule: CourtPricingRule = {
    pricingRuleId: 'rule-1', courtId: 'court-1', dayOfWeek: 'MONDAY',
    startTime: '08:00:00', endTime: '10:00:00', basePricePerHour: 150000,
    pricePerHour: 180000, effectiveFrom: '2026-08-30', effectiveTo: '2026-12-31'
  };
  const getVenues = { execute: vi.fn() };
  const manageCourts = { list: vi.fn() };
  const manageSchedule = {
    listRules: vi.fn(), createRule: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn(),
    listSlots: vi.fn(), generateSlots: vi.fn(), setSlotStatus: vi.fn(), deleteSlot: vi.fn()
  };
  const notify = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    getVenues.execute.mockReset().mockReturnValue(of([venue]));
    manageCourts.list.mockReset().mockReturnValue(of([{
      venueCourtId: 'court-1', venueId: 'venue-1', name: 'Sân 01', sportType: 'BADMINTON',
      capacity: 4, surfaceType: 'PVC', active: true
    }]));
    manageSchedule.listRules.mockReset().mockReturnValue(of([rule]));
    manageSchedule.listSlots.mockReset().mockReturnValue(of([]));
    manageSchedule.createRule.mockReset().mockReturnValue(of(rule));
    manageSchedule.updateRule.mockReset().mockReturnValue(of(rule));
    manageSchedule.deleteRule.mockReset().mockReturnValue(of(undefined));
    manageSchedule.generateSlots.mockReset().mockReturnValue(of([]));
    manageSchedule.setSlotStatus.mockReset();
    manageSchedule.deleteSlot.mockReset();
    notify.success.mockReset(); notify.error.mockReset();

    await TestBed.configureTestingModule({
      imports: [OwnerScheduleComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(
          LucideActivity, LucideAlertCircle, LucideCalendar, LucideInfo, LucideLandPlot,
          LucidePencil, LucidePlus, LucideReceipt, LucideRotateCcw, LucideShieldOff,
          LucideTrash2, LucideX
        ),
        { provide: GetMyOwnerVenuesUseCase, useValue: getVenues },
        { provide: ManageOwnerVenueCourtsUseCase, useValue: manageCourts },
        { provide: ManageOwnerScheduleUseCase, useValue: manageSchedule },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('tải quy tắc thật theo Venue và Court đã chọn', () => {
    const fixture = TestBed.createComponent(OwnerScheduleComponent);
    fixture.detectChanges();

    expect(manageSchedule.listRules).toHaveBeenCalledWith('court-1');
    expect(fixture.componentInstance.rules()).toEqual([rule]);
    expect(fixture.nativeElement.textContent).toContain('180.000 ₫');
  });

  it('chặn double submit khi tạo quy tắc giá', () => {
    const pending = new Subject<CourtPricingRule>();
    manageSchedule.createRule.mockReturnValue(pending);
    const fixture = TestBed.createComponent(OwnerScheduleComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openRuleEditor();
    component.ruleForm.patchValue({
      dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '10:00',
      basePricePerHour: 150000, pricePerHour: 180000,
      effectiveFrom: '2026-08-30', effectiveTo: '2026-12-31'
    });

    component.saveRule();
    component.saveRule();

    expect(manageSchedule.createRule).toHaveBeenCalledOnce();
    expect(component.savingRule()).toBe(true);
    expect(component.ruleForm.disabled).toBe(true);
  });

  it('hiển thị lỗi thật và cho retry tải dữ liệu', () => {
    manageSchedule.listRules.mockReturnValueOnce(throwError(() => ({ error: { message: 'Backend unavailable' } })));
    const fixture = TestBed.createComponent(OwnerScheduleComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.loadError()).toBe('Backend unavailable');
    manageSchedule.listRules.mockReturnValue(of([rule]));
    component.loadSchedule();

    expect(component.loadError()).toBeNull();
    expect(component.rules()).toEqual([rule]);
  });
});
