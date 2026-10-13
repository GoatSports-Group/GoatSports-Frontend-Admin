import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, Injector, OnInit, computed, inject, signal, viewChild
} from '@angular/core';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { TwoWayWindow } from '@shared/utils/two-way-window';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, filter, merge, of, switchMap, timer } from 'rxjs';
import {
  AiCapabilityOverview, AiStatus, BackgroundJob, InfrastructureStatus, SYSTEM_MONITOR_REPOSITORY_TOKEN, ServiceHealth,
  ServiceHealthStatus, ServiceIncident, ServiceTrends, SystemHealth
} from '@application/ports/persistence/system-monitor.repository';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

type Tab = 'services' | 'infra' | 'jobs' | 'ai';
const TABS: readonly Tab[] = ['services', 'infra', 'jobs', 'ai'];
/** Job có việc chờ lâu hơn mức này coi như đang chậm. */
const STALE_JOB_MS = 10 * 60_000;
type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const REFRESH_MS = 30_000;

/** Các service Prometheus đang thu số liệu (observability/prometheus/prometheus.yml). */
export const SERVICE_LABEL: Readonly<Record<string, { name: string; role: string }>> = {
  'api-gateway': { name: 'Cổng API', role: 'Định tuyến, xác thực, giới hạn tần suất' },
  'auth-service': { name: 'Tài khoản', role: 'Đăng nhập, phân quyền, hồ sơ người dùng' },
  'venue-service': { name: 'Sân & đặt sân', role: 'Cơ sở, lịch sân, đơn đặt, check-in' },
  'payment-service': { name: 'Thanh toán', role: 'payOS, hoàn tiền, chi trả chủ sân' },
  'club-service': { name: 'CLB & giải đấu', role: 'Câu lạc bộ, giải đấu, trận đội' },
  'social-service': { name: 'Cộng đồng', role: 'Bài viết, tin nhắn, kiểm duyệt' },
  'notification-service': { name: 'Thông báo', role: 'Thông báo realtime và hệ thống' },
  'report-service': { name: 'Báo cáo', role: 'Xuất PDF/Excel, báo cáo định kỳ' },
  'storage-service': { name: 'Lưu trữ tệp', role: 'Ảnh, hồ sơ, tài liệu' },
  'workflow-service': { name: 'Quy trình duyệt', role: 'Duyệt hồ sơ chủ sân' },
  'audit-service': { name: 'Nhật ký', role: 'Nhật ký kiểm toán, giám sát' },
  'ai-service': { name: 'AI', role: 'Ghép trận, gợi ý, dự báo, xác minh' }
};

const STATUS_META: Readonly<Record<ServiceHealthStatus, { label: string; tone: Tone; rank: number }>> = {
  DOWN: { label: 'Ngừng', tone: 'danger', rank: 0 },
  DEGRADED: { label: 'Suy giảm', tone: 'warning', rank: 1 },
  UNKNOWN: { label: 'Chưa có số liệu', tone: 'neutral', rank: 2 },
  UP: { label: 'Hoạt động', tone: 'success', rank: 3 }
};

const CAPABILITY_LABEL: Readonly<Record<string, string>> = {
  MATCHMAKING: 'Ghép trận',
  VENUE_RECOMMENDATION: 'Gợi ý sân',
  SEMANTIC_SEARCH: 'Tìm kiếm ngữ nghĩa',
  FEED_RANKING: 'Xếp hạng bảng tin',
  RAG: 'Trợ lý hỏi đáp (RAG)',
  DEMAND_FORECAST: 'Dự báo nhu cầu đặt sân',
  IDENTITY_VERIFICATION: 'Xác minh danh tính (CCCD)'
};

/**
 * Giám sát hệ thống: trạng thái và tài nguyên từng microservice (Prometheus, qua audit-service) và năng lực AI
 * (ai-service tự kiểm tra cấu hình, file model, MongoDB/Redis). Tự làm mới mỗi 30 giây khi tab đang mở.
 */
@Component({
  selector: 'app-system-monitor',
  templateUrl: './system-monitor.component.html',
  styleUrls: ['./system-monitor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, LucideIconComponent, LoadingSkeletonComponent, InfiniteScrollDirective]
})
export class SystemMonitorComponent implements OnInit {
  private readonly repository = inject(SYSTEM_MONITOR_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly refresh$ = new Subject<void>();

  readonly tab = signal<Tab>('services');
  readonly trendRange = signal<'1h' | '24h'>('1h');
  readonly trends = signal<ServiceTrends | null>(null);
  readonly incidents = signal<ServiceIncident[] | null>(null);
  readonly infrastructure = signal<InfrastructureStatus | null>(null);
  readonly infraLoading = signal(false);
  readonly infraError = signal<string | null>(null);
  readonly jobs = signal<BackgroundJob[] | null>(null);
  readonly jobsError = signal<string | null>(null);
  /** Hạ tầng hoặc job nền có vấn đề: hiện số trên tab. */
  readonly infraProblems = computed(() => {
    const infra = this.infrastructure();
    return infra ? infra.checks.filter(check => check.status !== 'UP').length : 0;
  });
  // Cuộn vô hạn hai chiều trong khung giới hạn chiều cao: sự cố 5 dòng một lần, các bảng khác 10 dòng.
  private readonly injector = inject(Injector);
  readonly incidentWindow = new TwoWayWindow(computed(() => this.incidents() ?? []), item => item.id, this.injector, 5, 15);
  readonly consumerWindow = new TwoWayWindow(computed(() => this.infrastructure()?.consumers ?? []), item => item.groupId,
    this.injector, 10, 30);
  readonly jobWindow = new TwoWayWindow(computed(() => this.jobs() ?? []), item => item.service + ':' + (item.job ?? ''),
    this.injector, 10, 30);
  readonly capabilityWindow = new TwoWayWindow(computed(() => this.ai()?.capabilities ?? []), item => item.capability,
    this.injector, 10, 30);
  private readonly incidentBox = viewChild<ElementRef<HTMLElement>>('incidentBox');
  private readonly consumerBox = viewChild<ElementRef<HTMLElement>>('consumerBox');
  private readonly jobBox = viewChild<ElementRef<HTMLElement>>('jobBox');
  private readonly capabilityBox = viewChild<ElementRef<HTMLElement>>('capabilityBox');

  /** Sentinel đầu / cuối của một khung: nối thêm dòng ở trên / ở dưới, giữ dòng đang nhìn đứng yên. */
  scroll(list: 'incident' | 'consumer' | 'job' | 'capability', direction: 'previous' | 'next'): void {
    const target = {
      incident: [this.incidentWindow, this.incidentBox()],
      consumer: [this.consumerWindow, this.consumerBox()],
      job: [this.jobWindow, this.jobBox()],
      capability: [this.capabilityWindow, this.capabilityBox()]
    }[list] as [TwoWayWindow<unknown>, ElementRef<HTMLElement> | undefined];
    target[0][direction](target[1]?.nativeElement);
  }

  readonly jobProblems = computed(() => (this.jobs() ?? []).filter(job => this.jobTone(job) !== 'success').length);
  readonly health = signal<SystemHealth | null>(null);
  readonly ai = signal<AiStatus | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly healthError = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);

  /** Service đã cấu hình nhưng Prometheus chưa thấy cũng hiện ra (Chưa có số liệu), xếp sự cố lên đầu. */
  readonly services = computed<ServiceHealth[]>(() => {
    const health = this.health();
    if (!health?.metricsAvailable) return [];
    const seen = new Map(health.services.map(item => [item.service, item]));
    Object.keys(SERVICE_LABEL).filter(name => !seen.has(name)).forEach(name => seen.set(name, {
      service: name, status: 'UNKNOWN', requestsPerSecond: null, errorRate: null, p95LatencyMs: null,
      cpuUsage: null, memoryUsedBytes: null, uptimeSeconds: null
    }));
    return [...seen.values()].sort((a, b) =>
      STATUS_META[a.status].rank - STATUS_META[b.status].rank || this.label(a.service).localeCompare(this.label(b.service), 'vi'));
  });

  readonly counts = computed(() => {
    const list = this.services();
    const by = (status: ServiceHealthStatus) => list.filter(item => item.status === status).length;
    return {
      total: list.length, up: by('UP'), degraded: by('DEGRADED'), down: by('DOWN'), unknown: by('UNKNOWN'),
      requestRate: list.reduce((sum, item) => sum + (item.requestsPerSecond ?? 0), 0)
    };
  });

  /** Một câu tình trạng chung cho dải đầu tab: nêu tên dịch vụ có sự cố, nặng nhất trước. */
  readonly overall = computed<{ tone: Tone; icon: string; title: string; detail: string }>(() => {
    const list = this.services();
    const names = (status: ServiceHealthStatus) => list.filter(item => item.status === status).map(item => this.label(item.service));
    const down = names('DOWN');
    const degraded = names('DEGRADED');
    const unknown = names('UNKNOWN');
    const parts = [
      down.length ? `${down.length} ngừng: ${down.join(', ')}` : '',
      degraded.length ? `${degraded.length} suy giảm: ${degraded.join(', ')}` : '',
      unknown.length ? `${unknown.length} chưa có số liệu` : ''
    ].filter(Boolean);
    if (down.length) return { tone: 'danger', icon: 'alert-circle', title: 'Có dịch vụ đang ngừng', detail: parts.join(' · ') };
    if (degraded.length) return { tone: 'warning', icon: 'alert-triangle', title: 'Một số dịch vụ đang chậm hoặc lỗi', detail: parts.join(' · ') };
    return {
      tone: 'success', icon: 'circle-check-big', title: 'Tất cả dịch vụ hoạt động bình thường',
      detail: parts.length ? parts.join(' · ') : `${list.length}/${list.length} dịch vụ hoạt động`
    };
  });

  readonly aiReady = computed(() => (this.ai()?.capabilities ?? []).filter(item => item.status === 'READY').length);

  /** Tình trạng chung của AI: hạ tầng mất kết nối nặng hơn tính năng chạy hạn chế. */
  readonly aiOverall = computed<{ tone: Tone; icon: string; title: string; detail: string }>(() => {
    const status = this.ai();
    if (!status) return { tone: 'neutral', icon: 'sparkles', title: '', detail: '' };
    const down = status.dependencies.filter(item => item.status === 'DOWN').map(item => item.name);
    const limited = status.capabilities.filter(item => item.status !== 'READY').map(item => this.capability(item));
    const total = status.capabilities.length;
    if (down.length) {
      return { tone: 'danger', icon: 'alert-circle', title: `Mất kết nối ${down.join(', ')}`,
        detail: `Các tính năng dùng ${down.join(', ')} có thể gián đoạn · ${this.aiReady()}/${total} tính năng sẵn sàng` };
    }
    if (limited.length) {
      return { tone: 'warning', icon: 'alert-triangle', title: `${limited.length} tính năng AI đang chạy hạn chế`,
        detail: `${limited.join(', ')} · ${this.aiReady()}/${total} tính năng sẵn sàng` };
    }
    return { tone: 'success', icon: 'circle-check-big', title: `Tất cả ${total} tính năng AI sẵn sàng`,
      detail: status.dependencies.map(item => `${item.name} ${item.latencyMs ?? 0} ms`).join(' · ') };
  });

  /** Tính năng đang mở popup chi tiết kỹ thuật. */
  readonly selectedCapability = signal<AiCapabilityOverview | null>(null);

  @HostListener('document:keydown.escape')
  closeCapability(): void { this.selectedCapability.set(null); }

  ngOnInit(): void {
    const requested = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (requested && TABS.includes(requested)) this.tab.set(requested);
    // Xu hướng, sự cố, hạ tầng, job nền: làm mới cùng nhịp nhưng tách khỏi luồng chính để chỗ chậm (Kafka lần đầu
    // vài giây) không giữ cả trang.
    merge(timer(0, REFRESH_MS).pipe(filter(() => !document.hidden)), this.refresh$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadExtras());
    // Tab trình duyệt đang ẩn thì bỏ lượt tự làm mới; bấm "Làm mới" vẫn chạy ngay.
    merge(timer(0, REFRESH_MS).pipe(filter(() => !document.hidden)), this.refresh$).pipe(
      switchMap(() => {
        this.refreshing.set(true);
        return merge(
          this.repository.getServicesHealth().pipe(catchError(err => of({ error: err } as const))),
          this.repository.getAiStatus().pipe(catchError(err => of({ aiError: err } as const)))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      if ('error' in result) {
        this.healthError.set(result.error?.error?.message ?? 'Không gọi được dịch vụ giám sát (audit-service).');
      } else if ('aiError' in result) {
        this.aiError.set('Không kết nối được ai-service. Các tính năng AI có thể đang gián đoạn.');
      } else if ('services' in result) {
        this.health.set(result);
        this.healthError.set(null);
      } else {
        this.ai.set(result);
        this.aiError.set(null);
      }
      this.loading.set(false);
      this.refreshing.set(false);
    });
  }

  refresh(): void { this.refresh$.next(); }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'services' ? null : tab }, replaceUrl: true });
    this.loadExtras();
  }

  setTrendRange(range: '1h' | '24h'): void {
    this.trendRange.set(range);
    this.loadTrends();
  }

  /** Luôn tải xu hướng + sự cố (rẻ); hạ tầng / job nền khi đang xem tab đó hoặc chưa tải lần nào (để hiện số trên tab). */
  private loadExtras(): void {
    this.loadTrends();
    this.repository.getIncidents(7).pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(list => { if (list) this.incidents.set(list); });
    if (this.tab() === 'infra' || !this.infrastructure()) this.loadInfrastructure();
    if (this.tab() === 'jobs' || !this.jobs()) this.loadJobs();
  }

  private loadTrends(): void {
    this.repository.getTrends(this.trendRange()).pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(trends => this.trends.set(trends));
  }

  private loadInfrastructure(): void {
    if (this.infraLoading()) return;
    this.infraLoading.set(true);
    this.repository.getInfrastructure().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: infra => { this.infrastructure.set(infra); this.infraError.set(null); this.infraLoading.set(false); },
      error: err => { this.infraError.set(err?.error?.message ?? 'Không kiểm tra được hạ tầng.'); this.infraLoading.set(false); }
    });
  }

  private loadJobs(): void {
    this.repository.getJobs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: jobs => { this.jobs.set(jobs); this.jobsError.set(null); },
      error: err => this.jobsError.set(err?.error?.message ?? 'Không đọc được tình trạng job nền.')
    });
  }

  /** Đường nhỏ (SVG 120 × 28) của request/giây; null = điểm thiếu, đường đứt ở đó. */
  sparkline(service: string): { path: string; peak: number; last: number | null } | null {
    const values = this.trends()?.requestsPerSecond[service];
    if (!values?.length || values.every(value => value == null)) return null;
    const peak = Math.max(...values.map(value => value ?? 0));
    const top = peak > 0 ? peak : 1;
    const step = values.length > 1 ? 120 / (values.length - 1) : 0;
    let path = '';
    let drawing = false;
    values.forEach((value, index) => {
      if (value == null) { drawing = false; return; }
      const x = (index * step).toFixed(1);
      const y = (26 - value / top * 24).toFixed(1);
      path += `${drawing ? 'L' : 'M'}${x},${y}`;
      drawing = true;
    });
    const last = [...values].reverse().find(value => value != null) ?? null;
    return { path, peak, last };
  }

  duration(seconds: number): string {
    if (seconds < 60) return `${seconds} giây`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours} giờ ${minutes % 60} phút` : `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
  }

  jobTone(job: BackgroundJob): Tone {
    if (!job.available) return 'danger';
    if (job.failedLast24h > 0) return 'danger';
    const waited = job.oldestPendingAt ? Date.now() - new Date(job.oldestPendingAt).getTime() : 0;
    return waited > STALE_JOB_MS ? 'warning' : 'success';
  }

  jobState(job: BackgroundJob): string {
    if (!job.available) return 'Không gọi được';
    if (job.failedLast24h > 0) return `${job.failedLast24h} lỗi / 24 giờ`;
    return this.jobTone(job) === 'warning' ? 'Đang chậm' : (job.pending + job.running ? 'Đang chạy' : 'Rảnh');
  }

  lagTone(lag: number): Tone { return lag >= 1000 ? 'danger' : lag > 0 ? 'warning' : 'success'; }

  label(service: string): string { return SERVICE_LABEL[service]?.name ?? service; }
  role(service: string): string { return SERVICE_LABEL[service]?.role ?? ''; }
  status(status: ServiceHealthStatus): { label: string; tone: Tone } { return STATUS_META[status]; }
  capability(item: AiCapabilityOverview): string { return CAPABILITY_LABEL[item.capability] ?? item.capability; }

  rate(value: number | null): string {
    return value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: value < 10 ? 2 : 0 });
  }

  percent(value: number | null): string {
    return value == null ? '—' : `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
  }

  latency(value: number | null): string {
    return value == null ? '—' : `${Math.round(value).toLocaleString('vi-VN')} ms`;
  }

  memory(bytes: number | null): string {
    if (bytes == null) return '—';
    const mb = bytes / 1024 / 1024;
    return mb >= 1024 ? `${(mb / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} GB` : `${Math.round(mb)} MB`;
  }

  uptime(seconds: number | null): string {
    if (seconds == null) return '—';
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    if (days) return `${days} ngày ${hours} giờ`;
    if (hours) return `${hours} giờ ${minutes} phút`;
    return `${Math.max(minutes, 1)} phút`;
  }

  metrics(item: AiCapabilityOverview): { key: string; value: string }[] {
    return Object.entries(item.activeModel?.metrics ?? {}).map(([key, value]) => ({
      key, value: Number.isInteger(value) ? value.toLocaleString('vi-VN') : value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
    }));
  }
}
