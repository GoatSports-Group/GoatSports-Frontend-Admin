import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCheck,
  LucideCircleCheck,
  LucideHistory,
  LucideShieldCheck,
  LucideUpload,
  provideLucideIcons
} from '@lucide/angular';
import { SearchAddressSuggestionsUseCase } from '@application/usecase/owner-application/search-address-suggestions.usecase';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { VenueOwnerApplicationFormComponent } from './venue-owner-application-form.component';

describe('VenueOwnerApplicationFormComponent', () => {
  const submitApplication = { execute: vi.fn() };
  const searchAddress = { execute: vi.fn(), resolve: vi.fn() };
  const notify = { warning: vi.fn(), success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), configurable: true });
    submitApplication.execute.mockReset().mockReturnValue(of(void 0));
    searchAddress.execute.mockReset().mockReturnValue(of([]));
    searchAddress.resolve.mockReset();
    notify.warning.mockReset();
    notify.success.mockReset();
    notify.error.mockReset();

    await TestBed.configureTestingModule({
      imports: [VenueOwnerApplicationFormComponent],
      providers: [
        provideLucideIcons(
          LucideArrowLeft,
          LucideArrowRight,
          LucideCheck,
          LucideCircleCheck,
          LucideHistory,
          LucideShieldCheck,
          LucideUpload
        ),
        { provide: SubmitOwnerApplicationUseCase, useValue: submitApplication },
        { provide: SearchAddressSuggestionsUseCase, useValue: searchAddress },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('renders the guided vertical step navigation and representative fields', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.owner-form-progress')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.stepper li')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.stepper li.is-active')?.textContent).toContain('Người đại diện');
    expect(fixture.nativeElement.querySelector('input[name="fullName"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Thông tin được bảo vệ theo chính sách của GoatSports.');
  });

  it('moves to the business step only after valid representative data', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.fullName = 'Đạt Minh';
    component.form.phone = '0867684603';
    component.form.email = 'datminh@example.com';
    component.form.identityNumber = '079098123456';

    component.nextStep();
    fixture.detectChanges();

    expect(component.currentStep()).toBe(2);
    expect(fixture.nativeElement.querySelector('input[name="businessName"]')).toBeTruthy();
    expect(submitApplication.execute).not.toHaveBeenCalled();
  });

  it('returns to history from the first step without claiming to save a draft', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.button--secondary') as HTMLButtonElement;
    expect(button.textContent).toContain('Quay lại lịch sử');
    button.click();

    expect(cancelled).toHaveBeenCalledOnce();
  });
});
