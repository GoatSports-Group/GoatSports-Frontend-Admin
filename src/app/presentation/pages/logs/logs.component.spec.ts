import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { Log } from '@application/dto/log/log.dto';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { LogService } from '@presentation/services/log.service';
import { LogsComponent } from './logs.component';
import { buildLogFilter } from './logs.utils';

describe('LogsComponent', () => {
  const log = (extra: Partial<Log>): Log => ({
    logId: 'l-1', userId: 'admin@gmail.com', action: 'LOGIN', description: 'Đăng nhập', ipAddress: '127.0.0.1',
    statusCode: 200, timestamp: '2026-10-13T08:00:00', errorMessage: '', ...extra
  });
  const logService = { getLogs: vi.fn(), getStats: vi.fn() };
  const users = { getSummaries: vi.fn() };

  beforeEach(async () => {
    logService.getLogs.mockReset().mockReturnValue(of({
      result: [log({}), log({ logId: 'l-2', userId: '83ce7473-db08-45d0-8f29-80c2b667f2c8', action: 'payment.succeeded.v1',
        statusCode: 0, sourceService: 'payment-service', correlationId: 'c-9' })],
      meta: { total: 2, page: 0, pageSize: 20, pages: 1 }
    }));
    logService.getStats.mockReset().mockReturnValue(of({
      from: '', to: '', totalRequests: 40, errorRequests: 4, status2xx: 36, status3xx: 0, status4xx: 3, status5xx: 1,
      activeUsers: 5, actions: ['LOGIN', 'CUSTOM_ACTION'], hourly: Array.from({ length: 24 }, (_, hour) => hour === 9 ? 30 : 0)
    }));
    users.getSummaries.mockReset().mockImplementation((ids: string[]) =>
      of(ids.map(userId => ({ userId, fullName: 'Minh Đạt', email: 'dat@goat.test' }))));
    await TestBed.configureTestingModule({
      imports: [LogsComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: LogService, useValue: logService },
        { provide: USER_REPOSITORY_TOKEN, useValue: users }
      ]
    }).compileComponents();
  });

  it('shows today in plain words and resolves event actors by id in one batch', () => {
    const fixture = TestBed.createComponent(LogsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const text = fixture.nativeElement.textContent as string;

    expect(page.errorsToday()).toEqual({ count: 4, rate: 0.1 });
    expect(text).toContain('Đăng nhập');
    expect(text).toContain('Thanh toán thành công');
    expect(text).toContain('Minh Đạt');
    expect(users.getSummaries).toHaveBeenCalledTimes(1);
    // Mã hành động lạ vẫn chọn được trong bộ lọc, hiện nguyên mã.
    expect(page.actionOptions().some(option => option.value === 'CUSTOM_ACTION')).toBe(true);
  });

  it('applies filters right away from the first page and opens the full record', () => {
    const fixture = TestBed.createComponent(LogsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.goToPage(2);
    page.result.set('error');
    page.reload();

    expect(logService.getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, filter: 'statusCode >= 400' }));

    page.open(page.logs()[1]);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement).textContent).toContain('c-9');
  });

  it('builds a safe filter: regex characters in the keyword cannot break the query', () => {
    expect(buildLogFilter({ query: "a.b (x)'", action: 'LOGIN', source: 'api-gateway', result: 'ok', fromDate: '', toDate: '' }))
      .toBe("description ~ 'a.b .x.\\'' and action = 'LOGIN' and sourceService = 'api-gateway' and statusCode < 400");
  });
});
