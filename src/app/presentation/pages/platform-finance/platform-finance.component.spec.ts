import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { ADMIN_FINANCE_REPOSITORY_TOKEN, FinanceRefund, FinanceSummary } from '@application/ports/persistence/admin-finance.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { REPORT_EXPORT_REPOSITORY_TOKEN } from '@application/ports/persistence/report-export.repository';
import { ConfirmService } from '@presentation/services/confirm.service';
import { PlatformFinanceComponent } from './platform-finance.component';

describe('PlatformFinanceComponent', () => {
  const summary: FinanceSummary = {
    from: '2026-09-11', to: '2026-10-10', collected: 300_000, platformFee: 15_000, paymentCount: 2, refunded: 30_000,
    paidOutToOwners: 0, refundsNeedingAttention: 2, failedRefunds: 1, staleRefunds: 3
  };
  const failedRefund: FinanceRefund = {
    refundId: 'r-1', paymentId: 'p-1', payerId: 'u-1', purpose: 'BOOKING_DEPOSIT', referenceType: 'BOOKING', referenceId: 'b-1',
    amount: 80_000, status: 'FAILED', reason: 'Hủy sân', failureReason: 'payOS từ chối', retryCount: 6,
    createdAt: '2026-10-05T12:00:00', updatedAt: '2026-10-06T12:00:00', refundedAt: null, providerRefundId: null,
    paymentDescription: 'Đặt cọc GSA02RT2', lastRemindedAt: null, remindable: true
  };
  const repository = {
    getSummary: vi.fn(), getPayments: vi.fn(), getRefunds: vi.fn(), getRefund: vi.fn(), getPayouts: vi.fn(),
    retryFailedRefunds: vi.fn(), remindRefund: vi.fn(), requestExport: vi.fn()
  };
  const users = { getSummaries: vi.fn(), getUsers: vi.fn() };
  const exports = { list: vi.fn(() => of([])), download: vi.fn() };
  const confirm = { ask: vi.fn() };

  beforeEach(async () => {
    repository.getSummary.mockReset().mockReturnValue(of(summary));
    repository.getPayments.mockReset().mockReturnValue(of({ items: [], total: 0 }));
    repository.getRefunds.mockReset().mockReturnValue(of({ items: [failedRefund], total: 1 }));
    repository.getPayouts.mockReset().mockReturnValue(of({ items: [], total: 0 }));
    repository.retryFailedRefunds.mockReset().mockReturnValue(of({ attempted: 3, succeeded: 1, processing: 1, failed: 1 }));
    repository.remindRefund.mockReset().mockReturnValue(of({ ...failedRefund, lastRemindedAt: new Date().toISOString() }));
    repository.getRefund.mockReset().mockReturnValue(of({ refund: failedRefund, payout: null }));
    users.getUsers.mockReset().mockReturnValue(of({ meta: { page: 0, pageSize: 50, pages: 1, total: 1 }, result: [{ userId: 'u-1' }] }));
    users.getSummaries.mockReset().mockReturnValue(of([{ userId: 'u-1', fullName: 'Nguyễn Văn A', email: 'a@goat.test' }]));
    confirm.ask.mockReset().mockReturnValue(of(true));
    await TestBed.configureTestingModule({
      imports: [PlatformFinanceComponent],
      providers: [
        provideRouter([]),
        provideLucideIcons(...APP_ICONS),
        { provide: ADMIN_FINANCE_REPOSITORY_TOKEN, useValue: repository },
        { provide: USER_REPOSITORY_TOKEN, useValue: users },
        { provide: REPORT_EXPORT_REPOSITORY_TOKEN, useValue: exports },
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
    // Danh sách theo kỳ đầu trang, như tab Giao dịch.
    expect(repository.getRefunds).toHaveBeenLastCalledWith({
      statuses: ['FAILED', 'MANUAL_REVIEW'], from, to, keyword: '', people: [], olderThanDays: undefined
    }, 0, 20);
    expect(fixture.nativeElement.textContent).toContain('1 chi lỗi · 1 chờ chủ sân hoàn tay');
    // Một lần tra tên cho cả trang.
    expect(users.getSummaries).toHaveBeenCalledWith(['u-1']);
    expect(fixture.nativeElement.textContent).toContain('Nguyễn Văn A');
    // Không còn nút chi lại từng khoản: người chơi tự bấm "Thử lại", admin chỉ nhắc.
    expect(fixture.nativeElement.textContent).toContain('Nhắc');
    expect(fixture.nativeElement.textContent).toContain('Chi lại tất cả khoản lỗi (1)');
  });

  it('the stale tile lists refunds still waiting on someone for over 7 days', () => {
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();

    fixture.componentInstance.openStale();

    expect(repository.getRefunds).toHaveBeenLastCalledWith(expect.objectContaining({
      statuses: ['AWAITING_CLAIM', 'AWAITING_BANK_ACCOUNT', 'FAILED', 'MANUAL_REVIEW'], olderThanDays: 7
    }), 0, 20);
    // Thẻ đếm 3 khoản mọi lúc, danh sách trong kỳ chỉ có 1: báo 2 khoản nằm ngoài kỳ.
    expect(fixture.componentInstance.outsidePeriod()).toBe(2);
  });

  it('searches by name or email through the user directory and sends the matching ids', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(PlatformFinanceComponent);
      fixture.detectChanges();
      const page = fixture.componentInstance;
      page.setTab('refunds');

      page.onKeyword('  Nguyễn ');
      vi.advanceTimersByTime(300);

      expect(users.getUsers.mock.calls[0][0].filter).toContain("fullName ~~ '*nguyễn*' or email ~~ '*nguyễn*'");
      expect(repository.getRefunds).toHaveBeenLastCalledWith(expect.objectContaining(
        { statuses: ['FAILED', 'MANUAL_REVIEW'], keyword: 'Nguyễn', people: ['u-1'] }), 0, 20);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reminds once, then disables the button for 24 hours', () => {
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.setTab('refunds');

    page.remind(failedRefund);

    expect(repository.remindRefund).toHaveBeenCalledWith('r-1');
    expect(page.notice()).toBe('Đã gửi nhắc cho Nguyễn Văn A.');
    expect(page.recentlyReminded(page.refunds()[0])).toBe(true);
    expect(page.recentlyReminded({ ...failedRefund, lastRemindedAt: '2026-01-01T00:00:00' })).toBe(false);
  });

  it('bulk retry runs only after confirmation, reports the outcome and refreshes the numbers', () => {
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    confirm.ask.mockReturnValueOnce(of(false));
    page.retryAllFailed();
    expect(repository.retryFailedRefunds).not.toHaveBeenCalled();

    page.retryAllFailed();

    expect(repository.retryFailedRefunds).toHaveBeenCalledTimes(1);
    expect(page.notice()).toBe('Đã thử 3 khoản: 1 thành công, 1 đang chuyển, 1 vẫn lỗi.');
    expect(repository.getSummary).toHaveBeenCalledTimes(2);
  });

  it('exports the list being viewed through report-service, with the period and filters as its scope', () => {
    repository.requestExport.mockReturnValue(of({ exportId: 'e-1', status: 'PENDING' }));
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.setFilter('payoutKind', 'REFUND');
    page.setFilter('payoutGroup', 'failed');
    page.setTab('payouts');
    fixture.detectChanges();

    page.exportRequest('pdf').subscribe();

    expect(repository.requestExport).toHaveBeenCalledWith({
      kind: 'PAYOUTS', format: 'pdf', from: page.from(), to: page.to(),
      query: { kind: 'REFUND', statuses: ['FAILED', 'CANCELLED'], from: page.from(), to: page.to(), keyword: '', people: [] },
      scopeLabel: 'Chi hoàn cho người chơi · Lỗi / đã hủy'
    });
    expect(page.exportScope()[1]).toBe('Chi hoàn cho người chơi · Lỗi / đã hủy');
    // Nút xuất dùng chung (report-service) thay cho CSV tự dựng.
    expect(fixture.nativeElement.textContent).toContain('Xuất báo cáo');
    expect(fixture.nativeElement.textContent).not.toContain('Xuất CSV');
    expect(exports.list).toHaveBeenCalledWith(['FINANCE_REFUNDS', 'FINANCE_PAYOUTS']);
  });

  it('changing the period reloads the refunds and payouts lists too, and payouts are a lookup list', () => {
    const fixture = TestBed.createComponent(PlatformFinanceComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.setTab('payouts');

    page.setPeriod('from', '2026-09-14');

    expect(repository.getPayouts).toHaveBeenLastCalledWith(expect.objectContaining(
      { kind: 'OWNER_WITHDRAWAL', statuses: [], from: '2026-09-14' }), 0, 20);
    // Lượt rút lỗi không phải việc của admin: tab Chi trả không có badge, mặc định xem tất cả.
    expect(fixture.nativeElement.querySelector('.tabs .count')?.textContent?.trim()).toBe('2');
  });
});
