import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { AiStatus, SYSTEM_MONITOR_REPOSITORY_TOKEN, SystemHealth } from '@application/ports/persistence/system-monitor.repository';
import { SystemMonitorComponent } from './system-monitor.component';

describe('SystemMonitorComponent', () => {
  const health: SystemHealth = {
    checkedAt: '2026-10-10T03:00:00Z', metricsAvailable: true, grafanaUrl: 'http://grafana.test',
    services: [
      { service: 'venue-service', status: 'UP', requestsPerSecond: 4, errorRate: 0, p95LatencyMs: 120, cpuUsage: 0.12,
        memoryUsedBytes: 300 * 1024 * 1024, uptimeSeconds: 90_000 },
      { service: 'payment-service', status: 'DOWN', requestsPerSecond: null, errorRate: null, p95LatencyMs: null,
        cpuUsage: null, memoryUsedBytes: null, uptimeSeconds: null }
    ]
  };
  const ai: AiStatus = {
    checkedAt: '2026-10-10T03:00:00Z',
    dependencies: [{ name: 'MongoDB', status: 'UP', latencyMs: 3.2, detail: null }, { name: 'Redis', status: 'DOWN', latencyMs: null, detail: 'ConnectionError' }],
    capabilities: [{
      capability: 'DEMAND_FORECAST', algorithm: 'Chronos-Bolt tiny', storage: 'MongoDB', status: 'READY', detail: 'Dự báo 7 ngày',
      activeModel: { modelName: 'chronos-bolt-tiny', version: 'a0e552d', trainedAt: null, metrics: { mae: 0.149 }, status: 'ACTIVE' }
    }]
  };
  const repository = {
    getServicesHealth: vi.fn(), getAiStatus: vi.fn(), getTrends: vi.fn(), getIncidents: vi.fn(), getInfrastructure: vi.fn(),
    getJobs: vi.fn()
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    repository.getServicesHealth.mockReset().mockReturnValue(of(health));
    repository.getAiStatus.mockReset().mockReturnValue(of(ai));
    repository.getTrends.mockReset().mockReturnValue(of({
      range: '1h', start: '2026-10-14T02:00:00Z', stepSeconds: 60,
      requestsPerSecond: { 'venue-service': [1, null, 3, 2], 'payment-service': [null, null] }
    }));
    repository.getIncidents.mockReset().mockReturnValue(of([
      { id: 'i-1', service: 'payment-service', status: 'DOWN', startedAt: '2026-10-14T02:50:00Z', endedAt: null, durationSeconds: 600, alerted: true },
      { id: 'i-2', service: 'venue-service', status: 'DEGRADED', startedAt: '2026-10-13T10:00:00Z', endedAt: '2026-10-13T10:04:00Z', durationSeconds: 240, alerted: false }
    ]));
    repository.getInfrastructure.mockReset().mockReturnValue(of({
      checkedAt: '2026-10-14T03:00:00Z',
      checks: [{ name: 'PostgreSQL', status: 'UP', latencyMs: 4, detail: 'localhost:5432' },
        { name: 'Kafka', status: 'DOWN', latencyMs: null, detail: 'Không gọi được broker' }],
      consumers: [{ groupId: 'audit-service-group', state: 'Stable', members: 1, topics: ['user-log-topic'], lag: 1500 }]
    }));
    repository.getJobs.mockReset().mockReturnValue(of([
      { service: 'report-service', job: 'REPORT_EXPORTS', label: 'Xuất báo cáo chạy nền', pending: 1, running: 0, failedLast24h: 0,
        oldestPendingAt: new Date(Date.now() - 20 * 60_000).toISOString(), available: true, error: null },
      { service: 'payment-service', job: null, label: null, pending: 0, running: 0, failedLast24h: 0, oldestPendingAt: null,
        available: false, error: 'Không gọi được payment-service' }
    ]));
    await TestBed.configureTestingModule({
      imports: [SystemMonitorComponent],
      providers: [provideRouter([]), provideLucideIcons(...APP_ICONS), { provide: SYSTEM_MONITOR_REPOSITORY_TOKEN, useValue: repository }]
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(SystemMonitorComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
    return fixture;
  }

  it('puts outages first and lists configured services Prometheus has not seen as unknown', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;

    expect(page.services()[0].service).toBe('payment-service');
    expect(page.services()).toHaveLength(12);
    expect(page.services().find(item => item.service === 'ai-service')?.status).toBe('UNKNOWN');
    expect(page.counts()).toMatchObject({ up: 1, down: 1, unknown: 10 });
    expect(page.overall().tone).toBe('danger');
    expect(page.overall().detail).toContain('1 ngừng: Thanh toán');
    expect(page.uptime(90_000)).toBe('1 ngày 1 giờ');
    expect(fixture.nativeElement.textContent).toContain('Mở Grafana');
  });

  it('draws a trend line per service with gaps, and lists incidents with their duration', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;

    expect(page.sparkline('venue-service')).toMatchObject({ peak: 3, last: 2 });
    // Điểm thiếu làm đường đứt: bắt đầu lại bằng "M".
    expect(page.sparkline('venue-service')!.path.match(/M/g)).toHaveLength(2);
    expect(page.sparkline('payment-service')).toBeNull();
    expect(page.duration(600)).toBe('10 phút');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Lịch sử sự cố');
    expect(text).toContain('đang diễn ra');
    expect(text).toContain('đã báo admin');
  });

  it('shows incidents five at a time inside their box and appends the next five at the bottom', async () => {
    // jsdom không có CSS.escape (trình duyệt có); TwoWayWindow dùng nó để tìm dòng neo khi nối thêm.
    (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS ??= { escape: (value: string) => value };
    repository.getIncidents.mockReturnValue(of(Array.from({ length: 12 }, (_, index) => ({
      id: 'i-' + index, service: 'venue-service', status: 'DEGRADED', startedAt: '2026-10-14T02:00:00Z',
      endedAt: '2026-10-14T02:05:00Z', durationSeconds: 300, alerted: false
    }))));
    const fixture = await render();
    const page = fixture.componentInstance;

    expect(page.incidentWindow.items()).toHaveLength(5);
    expect(page.incidentWindow.hasAfter()).toBe(true);
    page.scroll('incident', 'next');
    expect(page.incidentWindow.items()).toHaveLength(10);
    expect(page.incidentWindow.hasBefore()).toBe(false);
  });

  it('flags infrastructure and background job problems on their tabs', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;

    expect(page.infraProblems()).toBe(1);
    // Việc chờ 20 phút = đang chậm; service không gọi được = lỗi.
    expect(page.jobs()!.map(job => page.jobTone(job))).toEqual(['warning', 'danger']);
    expect(page.jobProblems()).toBe(2);
    expect(page.lagTone(1500)).toBe('danger');

    page.setTab('infra');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('audit-service-group');
  });

  it('refreshes every 30 seconds', async () => {
    await render();
    expect(repository.getServicesHealth).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(repository.getServicesHealth).toHaveBeenCalledTimes(2);
    expect(repository.getAiStatus).toHaveBeenCalledTimes(2);
  });

  it('tells an unreachable Prometheus apart from services being down', async () => {
    repository.getServicesHealth.mockReturnValue(of({ ...health, metricsAvailable: false, services: [] }));
    const fixture = await render();

    expect(fixture.componentInstance.services()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Không đọc được Prometheus');
  });

  it('shows AI capabilities with the serving model and a failing dependency', async () => {
    const fixture = await render();
    fixture.componentInstance.setTab('ai');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Dự báo nhu cầu đặt sân');
    expect(text).toContain('chronos-bolt-tiny · a0e552d');
    expect(text).toContain('Mất kết nối');
    expect(fixture.componentInstance.aiOverall()).toMatchObject({ tone: 'danger', title: 'Mất kết nối Redis' });
  });

  it('keeps the services tab usable when ai-service is down', async () => {
    repository.getAiStatus.mockReturnValue(throwError(() => new Error('down')));
    const fixture = await render();

    expect(fixture.componentInstance.services()).toHaveLength(12);
    expect(fixture.componentInstance.aiError()).toContain('ai-service');
  });
});
