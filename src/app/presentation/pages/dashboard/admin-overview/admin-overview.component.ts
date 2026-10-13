import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, WritableSignal, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { CommunityStats, PlatformBookingStats, PlatformUserStats } from '@application/dto/admin-stats/admin-stats.dto';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { ADMIN_FINANCE_REPOSITORY_TOKEN, FinanceSummary } from '@application/ports/persistence/admin-finance.repository';
import { SOCIAL_MODERATION_REPOSITORY_TOKEN } from '@application/ports/persistence/social-moderation.repository';
import { SYSTEM_MONITOR_REPOSITORY_TOKEN, SystemHealth } from '@application/ports/persistence/system-monitor.repository';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { SERVICE_LABEL } from '../../system-monitor/system-monitor.component';

type Range = 7 | 30 | 90;
type Metric = 'bookings' | 'gmv';
type Section<T> = { loading: boolean; error: boolean; data: T | null };
type Tone = 'good' | 'bad' | 'flat';

export interface Kpi {
  key: string;
  label: string;
  value: string;
  /** Chênh lệch so với kỳ trước cùng độ dài; null khi kỳ trước không có số liệu để so. */
  delta: { text: string; tone: Tone; icon: string } | null;
  spark: number[];
  hint: string;
  loading: boolean;
  error: boolean;
}

export interface AttentionItem {
  key: string;
  icon: string;
  label: string;
  hint: string;
  count: number | null;
  link: string;
  query?: Record<string, string>;
  failed: boolean;
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã nhận sân', COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy', REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền', EXPIRED: 'Hết hạn',
  NO_SHOW: 'Không đến nhận sân'
};
const LOST_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'REFUND_PENDING'];

/** Thứ tự cố định theo bảng categorical đã kiểm định (dataviz validator, 3 ô đầu đạt all-pairs ở cả hai chế độ). */
export const ROLE_SERIES: readonly { role: string; label: string; slot: number }[] = [
  { role: 'PLAYER', label: 'Người chơi', slot: 1 },
  { role: 'VENUE_OWNER', label: 'Chủ sân', slot: 2 },
  { role: 'ADMIN', label: 'Quản trị', slot: 3 }
];

const empty = <T>(): Section<T> => ({ loading: true, error: false, data: null });

/**
 * Bảng điều hành của admin: sức khỏe hệ thống và việc cần xử lý trước (như "Things to do" của Shopify), rồi 4 chỉ số
 * cốt lõi có xu hướng và so với kỳ trước (Stripe), biểu đồ theo ngày, cơ cấu đơn, top cơ sở và quy mô nền tảng.
 * Mỗi nguồn (auth, venue, club, payment, social, audit) tải độc lập: một nguồn lỗi chỉ làm hỏng khối của nó.
 */
@Component({
  selector: 'app-admin-overview',
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, RouterLink, LucideIconComponent, LoadingSkeletonComponent]
})
export class AdminOverviewComponent implements OnInit {
  private readonly stats = inject(ADMIN_STATS_REPOSITORY_TOKEN);
  private readonly finance = inject(ADMIN_FINANCE_REPOSITORY_TOKEN);
  private readonly moderation = inject(SOCIAL_MODERATION_REPOSITORY_TOKEN);
  private readonly monitor = inject(SYSTEM_MONITOR_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  /** Đơn đăng ký chủ sân đang chờ duyệt (trang cha đã tải cùng bản đồ). */
  readonly pendingApplications = input<number | null>(null);
  readonly applicationsFailed = input(false);

  readonly ranges: readonly Range[] = [7, 30, 90];
  readonly roleSeries = ROLE_SERIES;
  readonly range = signal<Range>(30);
  readonly metric = signal<Metric>('bookings');
  readonly updatedAt = signal<Date>(new Date());
  readonly today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date());

  readonly users = signal<Section<PlatformUserStats>>(empty());
  readonly previousUsers = signal<Section<PlatformUserStats>>(empty());
  readonly bookings = signal<Section<PlatformBookingStats>>(empty());
  readonly previousBookings = signal<Section<PlatformBookingStats>>(empty());
  readonly community = signal<Section<CommunityStats>>(empty());
  readonly money = signal<Section<FinanceSummary>>(empty());
  readonly health = signal<Section<SystemHealth>>(empty());
  readonly reports = signal<Section<number>>(empty());
  readonly appeals = signal<Section<number>>(empty());
  readonly hovered = signal<number | null>(null);

  readonly kpis = computed<Kpi[]>(() => {
    const current = this.bookings();
    const previous = this.previousBookings().data;
    const users = this.users();
    const days = current.data?.byDay ?? [];
    const cancel = this.cancelRate(current.data);
    const previousCancel = this.cancelRate(previous);
    const lost = this.lostBookings(current.data);
    return [
      {
        key: 'gmv', label: 'Giá trị giao dịch', value: this.vnd(current.data?.gmv),
        delta: this.changeOf(current.data?.gmv, previous?.gmv, true), spark: days.map(day => day.gmv),
        hint: 'GMV: đơn đã xác nhận, nhận sân, hoàn tất', loading: current.loading && !current.data, error: current.error
      },
      {
        key: 'bookings', label: 'Đơn đặt sân', value: this.count(current.data?.bookings),
        delta: this.changeOf(current.data?.bookings, previous?.bookings, true), spark: days.map(day => day.bookings),
        hint: `${this.count(current.data?.activeVenues)} cơ sở đang nhận đơn`, loading: current.loading && !current.data,
        error: current.error
      },
      {
        key: 'users', label: 'Người dùng mới', value: this.count(users.data?.newUsers),
        delta: this.changeOf(users.data?.newUsers, this.previousUsers().data?.newUsers, true),
        spark: (users.data?.newByDay ?? []).map(day => day.count),
        hint: `${this.count(users.data?.total)} tài khoản trên nền tảng`, loading: users.loading && !users.data, error: users.error
      },
      {
        key: 'cancel', label: 'Tỉ lệ hủy', value: cancel === null ? '—' : this.percent(cancel),
        delta: cancel === null || previousCancel === null ? null : this.pointsOf(cancel, previousCancel),
        spark: [], hint: `${this.count(lost)} đơn hủy, hết hạn hoặc hoàn tiền`,
        loading: current.loading && !current.data, error: current.error
      }
    ];
  });

  readonly attention = computed<AttentionItem[]>(() => {
    const money = this.money();
    const health = this.health();
    const incidents = health.data?.metricsAvailable
      ? health.data.services.filter(item => item.status === 'DOWN' || item.status === 'DEGRADED').length : null;
    const items: AttentionItem[] = [
      { key: 'applications', icon: 'clipboard-check', label: 'Hồ sơ chủ sân chờ duyệt', hint: 'Thẩm định giấy tờ và cơ sở',
        count: this.pendingApplications(), link: '/admin/owner-applications', failed: this.applicationsFailed() },
      { key: 'reports', icon: 'flag', label: 'Báo cáo nội dung', hint: 'Bài viết, bình luận bị báo cáo',
        count: this.reports().data, link: '/admin/moderation', failed: this.reports().error },
      { key: 'appeals', icon: 'gavel', label: 'Khiếu nại của tác giả', hint: 'Xét lại nội dung đã xử lý',
        count: this.appeals().data, link: '/admin/moderation', failed: this.appeals().error },
      { key: 'refunds', icon: 'undo-2', label: 'Khoản hoàn cần xử lý', hint: 'Chi lỗi hoặc chờ chủ sân hoàn tay',
        count: money.data?.refundsNeedingAttention ?? null, link: '/admin/platform-finance', query: { tab: 'refunds' },
        failed: money.error },
      { key: 'services', icon: 'server', label: 'Dịch vụ gặp sự cố', hint: 'Ngừng hoặc suy giảm',
        count: incidents, link: '/admin/system', failed: health.error || (!!health.data && !health.data.metricsAvailable) }
    ];
    return items;
  });

  /** Việc thật sự còn tồn: chỉ những mục có số > 0, nhiều nhất lên đầu. */
  readonly openWork = computed(() => this.attention()
    .filter(item => (item.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0)));
  readonly openWorkTotal = computed(() => this.openWork().reduce((sum, item) => sum + (item.count ?? 0), 0));
  readonly attentionLoading = computed(() => this.attention().some(item => item.count === null && !item.failed));
  readonly attentionFailures = computed(() => this.attention().filter(item => item.failed));

  readonly healthSummary = computed(() => {
    const section = this.health();
    if (section.loading && !section.data) return { tone: 'neutral', icon: 'loader-2', text: 'Đang kiểm tra các dịch vụ...' };
    if (section.error) return { tone: 'neutral', icon: 'circle-help', text: 'Chưa gọi được dịch vụ giám sát' };
    const data = section.data!;
    if (!data.metricsAvailable) return { tone: 'neutral', icon: 'circle-help', text: 'Chưa đọc được số liệu Prometheus' };
    const total = Math.max(Object.keys(SERVICE_LABEL).length, data.services.length);
    const up = data.services.filter(item => item.status === 'UP').length;
    const broken = data.services.filter(item => item.status === 'DOWN' || item.status === 'DEGRADED');
    if (!broken.length) return { tone: 'success', icon: 'circle-check', text: `Hệ thống ổn định · ${up}/${total} dịch vụ hoạt động` };
    const names = broken.slice(0, 3).map(item => SERVICE_LABEL[item.service]?.name ?? item.service).join(', ');
    return {
      tone: broken.some(item => item.status === 'DOWN') ? 'danger' : 'warning', icon: 'triangle-alert',
      text: `${broken.length} dịch vụ gặp sự cố: ${names}${broken.length > 3 ? '…' : ''} · ${up}/${total} hoạt động`
    };
  });

  /** Cột theo ngày theo chỉ số đang chọn; trần là ngày cao nhất (tối thiểu 1 để tránh chia 0). */
  readonly bars = computed(() => {
    const metric = this.metric();
    const days = this.bookings().data?.byDay ?? [];
    const values = days.map(day => metric === 'gmv' ? day.gmv : day.bookings);
    const max = Math.max(1, ...values);
    return { max, days: days.map((day, index) => ({ ...day, value: values[index], height: (values[index] / max) * 100 })) };
  });

  readonly chartTotal = computed(() => {
    const data = this.bookings().data;
    const previous = this.previousBookings().data;
    if (!data) return null;
    return this.metric() === 'gmv'
      ? { value: this.vnd(data.gmv), delta: this.changeOf(data.gmv, previous?.gmv, true) }
      : { value: `${this.count(data.bookings)} đơn`, delta: this.changeOf(data.bookings, previous?.bookings, true) };
  });

  readonly statusRows = computed(() => {
    const data = this.bookings().data;
    if (!data) return [];
    const max = Math.max(1, ...Object.values(data.bookingsByStatus));
    return Object.entries(data.bookingsByStatus)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        label: BOOKING_STATUS_LABEL[status] ?? status, count, width: (count / max) * 100, lost: LOST_STATUSES.includes(status)
      }));
  });

  /** Cơ cấu tài khoản theo vai trò: thanh xếp chồng, mỗi đoạn tỉ lệ với tổng. */
  readonly roleMix = computed(() => {
    const data = this.users().data;
    if (!data) return null;
    const total = Math.max(1, ROLE_SERIES.reduce((sum, item) => sum + (data.byRole[item.role] ?? 0), 0));
    const segments = ROLE_SERIES
      .map(item => ({ ...item, count: data.byRole[item.role] ?? 0, share: ((data.byRole[item.role] ?? 0) / total) * 100 }))
      .filter(item => item.count > 0);
    return {
      segments,
      label: `Tài khoản theo vai trò: ${segments.map(item => `${item.label} ${this.count(item.count)}`).join(', ')}`,
      locked: data.byStatus['BLOCKED'] ?? 0
    };
  });

  readonly liveTournaments = computed(() => {
    const byStatus = this.community().data?.tournamentsByStatus;
    return byStatus ? (byStatus['REGISTRATION_OPEN'] ?? 0) + (byStatus['IN_PROGRESS'] ?? 0) : 0;
  });

  ngOnInit(): void { this.load(); }

  setRange(value: Range): void {
    if (value === this.range()) return;
    this.range.set(value);
    this.loadRanged();
  }

  setMetric(value: Metric): void {
    this.metric.set(value);
    this.hovered.set(null);
  }

  load(): void {
    this.loadRanged();
    this.fetch(this.stats.getCommunityStats(), this.community);
    this.fetch(this.monitor.getServicesHealth(), this.health);
    // Chỉ cần tổng số: hỏi trang 1 phần tử.
    this.fetch(this.moderation.getReportQueue({ status: ['PENDING', 'REVIEWING'], page: 0, size: 1 }).pipe(map(page => page.total)),
      this.reports);
    this.fetch(this.moderation.getAppealQueue({ status: ['PENDING'], page: 0, size: 1 }).pipe(map(page => page.total)), this.appeals);
  }

  /** Kỳ đang xem và kỳ ngay trước cùng độ dài (để tính chênh lệch), cùng tiền thu trong kỳ. */
  private loadRanged(): void {
    const days = this.range();
    const to = new Date();
    const from = this.shift(to, -(days - 1));
    const previousTo = this.shift(from, -1);
    const previousFrom = this.shift(previousTo, -(days - 1));
    this.updatedAt.set(new Date());
    this.fetch(this.stats.getUserStats(this.iso(from), this.iso(to)), this.users);
    this.fetch(this.stats.getBookingStats(this.iso(from), this.iso(to)), this.bookings);
    // ponytail: kỳ trước tải cả payload (theo ngày, top cơ sở) dù chỉ cần tổng; thêm API tổng gọn nếu số liệu lớn.
    this.fetch(this.stats.getUserStats(this.iso(previousFrom), this.iso(previousTo)), this.previousUsers);
    this.fetch(this.stats.getBookingStats(this.iso(previousFrom), this.iso(previousTo)), this.previousBookings);
    this.fetch(this.finance.getSummary(this.iso(from), this.iso(to)), this.money);
  }

  private fetch<T>(source: Observable<T>, target: WritableSignal<Section<T>>): void {
    target.set({ loading: true, error: false, data: target().data });
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => target.set({ loading: false, error: false, data }),
      error: () => target.set({ loading: false, error: true, data: null })
    });
  }

  /** Đường sparkline trong khung 100 × 32 (viewBox), chừa 3px trên dưới cho nét 2px. */
  sparkPath(values: number[]): string {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    return values.map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 29 - ((value - min) / span) * 26;
      return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }

  sparkEnd(values: number[]): { x: number; y: number } | null {
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { x: 100, y: 29 - ((values[values.length - 1] - min) / (max - min || 1)) * 26 };
  }

  changeOf(current: number | null | undefined, previous: number | null | undefined, upIsGood: boolean): Kpi['delta'] {
    if (current == null || previous == null) return null;
    if (previous === 0) return current === 0 ? { text: 'Như kỳ trước', tone: 'flat', icon: 'minus' } : null;
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 0.05) return { text: 'Như kỳ trước', tone: 'flat', icon: 'minus' };
    const up = change > 0;
    return {
      text: `${up ? '+' : '−'}${Math.abs(change).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước`,
      tone: up === upIsGood ? 'good' : 'bad', icon: up ? 'trending-up' : 'trending-down'
    };
  }

  /** Tỉ lệ so tỉ lệ: chênh lệch tính bằng điểm phần trăm; tăng là xấu. */
  private pointsOf(current: number, previous: number): Kpi['delta'] {
    const diff = Math.round((current - previous) * 10) / 10;
    if (diff === 0) return { text: 'Như kỳ trước', tone: 'flat', icon: 'minus' };
    return {
      text: `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm so với kỳ trước`,
      tone: diff > 0 ? 'bad' : 'good', icon: diff > 0 ? 'trending-up' : 'trending-down'
    };
  }

  private lostBookings(data: PlatformBookingStats | null): number {
    return data ? LOST_STATUSES.reduce((sum, status) => sum + (data.bookingsByStatus[status] ?? 0), 0) : 0;
  }

  cancelRate(data: PlatformBookingStats | null): number | null {
    if (!data?.bookings) return null;
    return Math.round((this.lostBookings(data) / data.bookings) * 1000) / 10;
  }

  barValue(value: number): string { return this.metric() === 'gmv' ? this.vnd(value) : `${this.count(value)} đơn`; }

  vnd(value: number | null | undefined): string {
    const amount = value ?? 0;
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr ₫`;
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))} ₫`;
  }

  count(value: number | null | undefined): string { return new Intl.NumberFormat('vi-VN').format(value ?? 0); }

  percent(value: number | null): string {
    return `${(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
  }

  /** "T7, 12/09": thứ và ngày theo tiếng Việt (DatePipe của app không nạp locale vi). */
  dayLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .format(new Date(year, month - 1, day));
  }

  private shift(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private iso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
