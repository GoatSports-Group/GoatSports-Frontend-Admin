import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { Log } from '@application/dto/log/log.dto';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { LogService } from '@presentation/services/log.service';
import { LogsComponent } from './logs.component';
import { buildLogFilter, todayRange } from './logs.utils';

describe('LogsComponent', () => {
  const log = (extra: Partial<Log>): Log => ({
    logId: 'l-1', userId: 'admin@gmail.com', action: 'LOGIN', description: 'Đăng nhập', ipAddress: '127.0.0.1',
    statusCode: 200, timestamp: '2026-10-13T08:00:00', errorMessage: '', ...extra
  });
  const logService = { getLogs: vi.fn(), getStats: vi.fn(), getFailedLoginBursts: vi.fn(), resolveFailedLogins: vi.fn(() => of(undefined)) };
  const users = { getSummaries: vi.fn(), getUsers: vi.fn() };

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
    logService.getFailedLoginBursts.mockReset().mockReturnValue(of([
      { account: 'attacker@x.vn', attempts: 7, firstAt: '2026-10-14T08:00:00', lastAt: '2026-10-14T08:10:00', lastIp: '1.2.3.4' }
    ]));
    users.getUsers.mockReset().mockReturnValue(of({ result: [{ userId: 'u-9', email: 'huy@goat.vn' }], meta: { total: 1 } }));
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
    expect(page.hourly()).toMatchObject({ total: 30, max: 30, peakHour: 9 });
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

  it('narrows to sensitive actions, follows a correlation chain and finds people by name', () => {
    const fixture = TestBed.createComponent(LogsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const lastFilter = () => logService.getLogs.mock.calls.at(-1)![0].filter as string;

    page.toggleSensitive();
    expect(lastFilter()).toContain("action = 'ADMIN_CHANGE_USER_STATUS'");

    page.showChain('c-9');
    expect(lastFilter()).toContain("correlationId = 'c-9'");
    page.clearChain();
    page.toggleSensitive();

    page.keyword.set('Huy');
    page.reload();
    expect(users.getUsers).toHaveBeenCalled();
    expect(lastFilter()).toContain("userId = 'huy@goat.vn'");
    expect(lastFilter()).toContain("userId = 'u-9'");
  });

  it('warns about repeated failed logins and filters to that account in one click', () => {
    const fixture = TestBed.createComponent(LogsComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('attacker@x.vn');
    expect(text).toContain('7 lần');

    fixture.componentInstance.inspectAccount('attacker@x.vn');
    expect(fixture.componentInstance.result()).toBe('error');
    expect(fixture.componentInstance.keyword()).toBe('attacker@x.vn');

    fixture.componentInstance.resolveFailedLogin('attacker@x.vn');
    expect(logService.resolveFailedLogins).toHaveBeenCalledWith('attacker@x.vn');
    expect(fixture.componentInstance.failedLogins()).toEqual([]);
  });

  it('builds a safe filter: regex characters in the keyword cannot break the query', () => {
    expect(buildLogFilter({ query: "a.b (x)'", source: 'api-gateway', result: 'ok', fromDate: '', toDate: '' }))
      .toBe("(description ~ 'a.b .x.\\'' or userId ~ 'a.b .x.\\'') and sourceService = 'api-gateway' and statusCode < 400");
  });

  it('matches actions by their Vietnamese label without accents, and by code', () => {
    const filter = buildLogFilter({ query: 'dang nhap', source: '', result: '', fromDate: '', toDate: '' }, ['CUSTOM_LOGIN_X']);
    expect(filter).toContain("action = 'LOGIN'");
    expect(buildLogFilter({ query: 'custom', source: '', result: '', fromDate: '', toDate: '' }, ['CUSTOM_LOGIN_X']))
      .toContain("action = 'CUSTOM_LOGIN_X'");
  });

  it('asks for today in local wall-clock time, the way audit timestamps are stored', () => {
    expect(todayRange(new Date(2026, 9, 14, 0, 55))).toMatchObject({ from: '2026-10-14T00:00:00', to: '2026-10-15T00:00:00' });
    expect(buildLogFilter({ query: '', source: '', result: '', fromDate: '2026-10-01', toDate: '2026-10-13' }))
      .toBe("timestamp >= '2026-10-01T00:00:00' and timestamp < '2026-10-14T00:00:00'");
  });
});
