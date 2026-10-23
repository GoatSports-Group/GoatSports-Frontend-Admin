import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { SearchAddressSuggestionsUseCase } from '@application/usecase/owner-application/search-address-suggestions.usecase';
import { SubmitOwnerApplicationUseCase } from '@application/usecase/owner-application/submit-owner-application.usecase';
import { AnalyzeOwnerFaceReadinessUseCase } from '@application/usecase/owner-application/analyze-owner-face-readiness.usecase';
import { VerifyOwnerIdentityUseCase } from '@application/usecase/owner-application/verify-owner-identity.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { VenueOwnerApplicationFormComponent } from './venue-owner-application-form.component';

describe('VenueOwnerApplicationFormComponent', () => {
  const submitApplication = { execute: vi.fn() };
  const analyzeFaceReadiness = { execute: vi.fn() };
  const verifyIdentity = { execute: vi.fn() };
  const searchAddress = { execute: vi.fn(), resolve: vi.fn() };
  const notify = { warning: vi.fn(), success: vi.fn(), error: vi.fn() };
  const repository = { getClaimableVenue: vi.fn() };
  const claimable = {
    externalVenueId: 'ext-1', name: 'Liber Pickleball', sportTypes: ['PICKLEBALL'], latitude: 10.8324,
    longitude: 106.6972, address: '12 Hiệp Bình', phone: '0909 123 456', claimedVenueId: null, wantCount: 37,
    matchCount: 2
  };

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
        provideLucideIcons(...APP_ICONS),
        { provide: SubmitOwnerApplicationUseCase, useValue: submitApplication },
        { provide: AnalyzeOwnerFaceReadinessUseCase, useValue: analyzeFaceReadiness },
        { provide: VerifyOwnerIdentityUseCase, useValue: verifyIdentity },
        { provide: SearchAddressSuggestionsUseCase, useValue: searchAddress },
        { provide: NotifyService, useValue: notify },
        { provide: OWNER_APPLICATION_REPOSITORY_TOKEN, useValue: repository }
      ]
    }).compileComponents();
  });

  it('prefills the application from the invited venue and can drop the claim', () => {
    repository.getClaimableVenue.mockReturnValue(of(claimable));
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.componentRef.setInput('claimVenueId', 'ext-1');
    fixture.detectChanges();
    const form = fixture.componentInstance;

    expect(repository.getClaimableVenue).toHaveBeenCalledWith('ext-1');
    expect(fixture.nativeElement.textContent).toContain('Bạn đang nhận quản lý sân Liber Pickleball');
    expect(fixture.nativeElement.textContent).toContain('37 người chơi đang chờ');
    expect(form.form.businessName).toBe('Liber Pickleball');
    expect(form.form.address).toBe('12 Hiệp Bình');
    expect([form.form.latitude, form.form.longitude]).toEqual([10.8324, 106.6972]);

    form.dropClaim();
    fixture.detectChanges();
    expect(form.claimVenue()).toBeNull();
    expect(form.form.businessName).toBe('Liber Pickleball');
  });

  it('refuses to claim a venue that already has an owner', () => {
    repository.getClaimableVenue.mockReturnValue(of({ ...claimable, claimedVenueId: 'venue-9' }));
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    fixture.componentRef.setInput('claimVenueId', 'ext-1');
    fixture.detectChanges();

    expect(fixture.componentInstance.claimVenue()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('đã có chủ quản lý');
    expect(fixture.componentInstance.form.businessName).toBe('');
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

  it('accepts only a PDF business license and enforces the 2 MB limit', () => {
    const fixture = TestBed.createComponent(VenueOwnerApplicationFormComponent);
    const component = fixture.componentInstance;
    const pdf = new File(['pdf'], 'license.pdf', { type: 'application/pdf' });

    component.selectFile('businessLicense', {
      target: { files: [pdf], value: 'license.pdf' }
    } as unknown as Event);

    expect(component.files.businessLicense).toBe(pdf);

    const oversizedImage = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      'venue.jpg',
      { type: 'image/jpeg' }
    );
    component.selectFile('venueImage', {
      target: { files: [oversizedImage], value: 'venue.jpg' }
    } as unknown as Event);

    expect(component.files.venueImage).toBeNull();
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('2MB'));
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
