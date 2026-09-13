import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCheck,
  LucideCircleCheck,
  LucideEye,
  LucideHistory,
  LucideImageUp,
  LucideScanFace,
  LucideScanQrCode,
  LucideShieldCheck,
  LucideSun,
  LucideUpload,
  LucideUserCheck,
  LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { SearchAddressSuggestionsUseCase } from '@application/usecase/owner-application/search-address-suggestions.usecase';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { AnalyzeOwnerFaceReadinessUseCase } from '@application/usecase/owner-application/analyze-owner-face-readiness.usecase';
import { VerifyOwnerIdentityUseCase } from '@application/usecase/owner-application/verify-owner-identity.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { VenueOwnerApplicationFormComponent } from './venue-owner-application-form.component';

describe('VenueOwnerApplicationFormComponent', () => {
  const submitApplication = { execute: vi.fn() };
  const analyzeFaceReadiness = { execute: vi.fn() };
  const verifyIdentity = { execute: vi.fn() };
  const searchAddress = { execute: vi.fn(), resolve: vi.fn() };
  const notify = { warning: vi.fn(), success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), configurable: true });
    submitApplication.execute.mockReset().mockReturnValue(of(void 0));
    analyzeFaceReadiness.execute.mockReset();
    verifyIdentity.execute.mockReset();
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
          LucideEye,
          LucideHistory,
          LucideImageUp,
          LucideScanFace,
          LucideScanQrCode,
          LucideShieldCheck,
          LucideSun,
          LucideUpload,
          LucideUserCheck,
          LucideX
        ),
        { provide: SubmitOwnerApplicationUseCase, useValue: submitApplication },
        { provide: AnalyzeOwnerFaceReadinessUseCase, useValue: analyzeFaceReadiness },
        { provide: VerifyOwnerIdentityUseCase, useValue: verifyIdentity },
        { provide: SearchAddressSuggestionsUseCase, useValue: searchAddress },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  it('renders the guided vertical step navigation and legal document fields', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.owner-form-progress')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.stepper li')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.stepper li.is-active')?.textContent).toContain('Hồ sơ pháp lý');
    expect(fixture.nativeElement.querySelectorAll('input[type="file"]')).toHaveLength(4);
    expect(fixture.nativeElement.textContent).toContain('Xác minh người đại diện');
  });

  it('stays on the legal document step while a required file is missing', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.nextStep();

    expect(component.currentStep()).toBe(1);
    expect(notify.warning).toHaveBeenCalledOnce();
    expect(verifyIdentity.execute).not.toHaveBeenCalled();
  });

  it('shows realtime checks without a manual face scan button', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.componentInstance.cameraActive.set(true);
    fixture.componentInstance.cameraReady.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.face-modal__scan')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Không đeo kính');
    expect(fixture.nativeElement.textContent).toContain('phân tích realtime');
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
