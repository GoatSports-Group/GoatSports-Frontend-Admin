import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { ADMIN_FINANCE_REPOSITORY_TOKEN, FinanceRefund, FinanceSummary } from '@application/ports/persistence/admin-finance.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { ConfirmService } from '@presentation/services/confirm.service';
import { PlatformFinanceComponent } from './platform-finance.component';

describe('PlatformFinanceComponent', () => {
  const summary: FinanceSummary = {
    from: '2026-09-11', to: '2026-10-10', collected: 300_000, platformFee: 15_000, paymentCount: 2, refunded: 30_000,
    paidOutToOwners: 0, refundsNeedingAttention: 2, payoutsNeedingAttention: 0
  };
  const failedRefund: FinanceRefund = {
    refundId: 'r-1', paymentId: 'p-1', payerId: 'u-1', purpose: 'BOOKING_DEPOSIT', referenceType: 'BOOKING', referenceId: 'b-1',
    amount: 80_000, status: 'FAILED', reason: 'Hủy sân', failureReason: 'payOS từ chối', retryCount: 6,
    createdAt: '2026-10-05T12:00:00', updatedAt: '2026-10-06T12:00:00', refundedAt: null, retryable: true
  };
  const repository = { getSummary: vi.fn(), getPayments: vi.fn(), getRefunds: vi.fn(), getPayouts: vi.fn(), retryRefund: vi.fn() };
  const users = { getSummaries: vi.fn() };
  const confirm = { ask: vi.fn() };

  beforeEach(async () => {
    repository.getSummary.mockReset().mockReturnValue(of(summary));
    repository.getPayments.mockReset().mockReturnValue(of({ items: [], total: 0 }));
    repository.getRefunds.mockReset().mockReturnValue(of({ items: [failedRefund], total: 1 }));
    repository.getPayouts.mockReset().mockReturnValue(of({ items: [], total: 0 }));
    repository.retryRefund.mockReset().mockReturnValue(of({ ...failedRefund, status: 'PROCESSING', retryable: false }));
    users.getSummaries.mockReset().mockReturnValue(of([{ userId: 'u-1', fullName: 'Nguyễn Văn A', email: 'a@goat.test' }]));
    confirm.ask.mockReset().mockReturnValue(of(true));
    await TestBed.configureTestingModule({
      imports: [PlatformFinanceComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_FINANCE_REPOSITORY_TOKEN, useValue: repository },
        { provide: USER_REPOSITORY_TOKEN, useValue: users },
        { provide: ConfirmService, useValue: confirm }
      ]
    }).compileComponents();
  });

  it('loads the last 30 days and the attention tile opens the refunds that need work', () => {
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    const [from, to] = repository.getSummary.mock.calls[0];
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000).toBe(29);
    expect(page.attention()).toBe(2);

    page.openAttention();
    fixture.detectChanges();

    expect(page.tab()).toBe('refunds');
    expect(repository.getRefunds).toHaveBeenLastCalledWith(['FAILED', 'MANUAL_REVIEW'], 0, 20);
    // Một lần tra tên cho cả trang.
    expect(users.getSummaries).toHaveBeenCalledWith(['u-1']);
    expect(fixture.nativeElement.textContent).toContain('Nguyễn Văn A');
    expect(fixture.nativeElement.textContent).toContain('Chi lại');
  });

  it('retries a failed refund only after confirmation and refreshes the numbers', () => {
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.setTab('refunds');

    confirm.ask.mockReturnValueOnce(of(false));
    page.retry(failedRefund);
    expect(repository.retryRefund).not.toHaveBeenCalled();

    page.retry(failedRefund);

    expect(repository.retryRefund).toHaveBeenCalledWith('r-1');
    expect(page.notice()).toContain('Đã gửi lệnh chi lại');
    expect(repository.getSummary).toHaveBeenCalledTimes(2);
  });
});
