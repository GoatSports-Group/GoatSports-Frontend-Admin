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
  const repository = { getServicesHealth: vi.fn(), getAiStatus: vi.fn() };

  beforeEach(async () => {
    vi.useFakeTimers();
    repository.getServicesHealth.mockReset().mockReturnValue(of(health));
    repository.getAiStatus.mockReset().mockReturnValue(of(ai));
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
    expect(page.uptime(90_000)).toBe('1 ngày 1 giờ');
    expect(fixture.nativeElement.textContent).toContain('Mở Grafana');
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
  });

  it('keeps the services tab usable when ai-service is down', async () => {
    repository.getAiStatus.mockReturnValue(throwError(() => new Error('down')));
    const fixture = await render();

    expect(fixture.componentInstance.services()).toHaveLength(12);
    expect(fixture.componentInstance.aiError()).toContain('ai-service');
  });
});
