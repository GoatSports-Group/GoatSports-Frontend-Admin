import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { SocialActivityStats } from '@application/dto/admin-stats/admin-stats.dto';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { UserDirectoryService } from '@presentation/services/user-directory.service';
import {
  Delta, HEAT_LEVELS, SPORT_LABEL, WEEKDAY_LONG, WEEKDAY_SHORT, changeOf, heatLevel, linePaths, peakCell
} from './community-analytics.utils';

type Range = 7 | 30 | 90;
type Metric = 'activeUsers' | 'posts' | 'comments' | 'likes';
type Day = SocialActivityStats['byDay'][number];

interface Kpi { key: string; label: string; value: string; delta: Delta | null; spark: number[]; hint: string }

const METRICS: readonly { key: Metric; label: string; unit: string }[] = [
  { key: 'activeUsers', label: 'Người hoạt động', unit: 'người' },
  { key: 'posts', label: 'Bài viết', unit: 'bài' },
  { key: 'comments', label: 'Bình luận', unit: 'bình luận' },
  { key: 'likes', label: 'Lượt thích', unit: 'lượt thích' }
];

/**
 * Hoạt động cộng đồng cho admin: ai đang hoạt động, đăng gì, tương tác ra sao, môn và chủ đề nào nóng, giờ nào đông.
 * Một lời gọi social-service trả cả kỳ trước để so; tên người dùng tra theo lô qua UserDirectoryService.
 */
@Component({
  selector: 'app-community-analytics',
  templateUrl: './community-analytics.component.html',
  styleUrls: ['./community-analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, LucideIconComponent, LoadingSkeletonComponent]
})
export class CommunityAnalyticsComponent implements OnInit {
  private readonly stats = inject(ADMIN_STATS_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  readonly users = inject(UserDirectoryService);

  readonly Math = Math;
  readonly ranges: readonly Range[] = [7, 30, 90];
  readonly metrics = METRICS;
  readonly weekdays = WEEKDAY_SHORT;
  readonly hours = Array.from({ length: 24 }, (_, hour) => hour);
  readonly heatSteps = Array.from({ length: HEAT_LEVELS }, (_, index) => index + 1);
  readonly range = signal<Range>(30);
  readonly metric = signal<Metric>('activeUsers');
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly data = signal<SocialActivityStats | null>(null);
  readonly hovered = signal<number | null>(null);
  readonly hoveredCell = signal<{ dayOfWeek: number; hour: number; count: number } | null>(null);

  readonly kpis = computed<Kpi[]>(() => {
    const data = this.data();
    if (!data) return [];
    const { totals, previous, byDay } = data;
    const interactions = totals.likes + totals.comments + totals.shares;
    const previousInteractions = previous.likes + previous.comments + previous.shares;
    const perPost = totals.posts ? interactions / totals.posts : null;
    const previousPerPost = previous.posts ? previousInteractions / previous.posts : null;
    return [
      { key: 'active', label: 'Người hoạt động', value: this.count(totals.activeUsers),
        delta: changeOf(totals.activeUsers, previous.activeUsers), spark: byDay.map(day => day.activeUsers),
        hint: `${this.count(totals.postingUsers)} người có đăng bài` },
      { key: 'posts', label: 'Bài viết mới', value: this.count(totals.posts), delta: changeOf(totals.posts, previous.posts),
        spark: byDay.map(day => day.posts), hint: `${this.count(totals.shares)} lượt chia sẻ lại` },
      { key: 'interactions', label: 'Lượt tương tác', value: this.count(interactions),
        delta: changeOf(interactions, previousInteractions),
        spark: byDay.map(day => day.likes + day.comments + day.shares),
        hint: `${this.count(totals.likes)} thích · ${this.count(totals.comments)} bình luận` },
      { key: 'per-post', label: 'Tương tác mỗi bài', value: perPost === null ? '—' : this.decimal(perPost),
        delta: perPost === null || previousPerPost === null ? null : changeOf(perPost, previousPerPost), spark: [],
        hint: `${this.count(totals.saves)} lượt lưu bài (không tính)` }
    ];
  });

  readonly metricInfo = computed(() => METRICS.find(item => item.key === this.metric())!);

  readonly chart = computed(() => {
    const days = this.data()?.byDay ?? [];
    const metric = this.metric();
    const values = days.map(day => day[metric]);
    return { days, values, ...linePaths(values), total: values.reduce((sum, value) => sum + value, 0) };
  });

  readonly sports = computed(() => {
    const rows = this.data()?.bySport ?? [];
    const max = Math.max(1, ...rows.map(row => row.interactions));
    return rows.map(row => ({ ...row, label: SPORT_LABEL[row.sport] ?? row.sport, width: (row.interactions / max) * 100 }));
  });

  readonly heat = computed(() => {
    const cells = this.data()?.heatmap ?? [];
    const max = Math.max(0, ...cells.map(cell => cell.count));
    const grid = WEEKDAY_SHORT.map((_, day) => this.hours.map(hour => {
      const cell = cells.find(item => item.dayOfWeek === day + 1 && item.hour === hour) ?? { dayOfWeek: day + 1, hour, count: 0 };
      return { ...cell, level: heatLevel(cell.count, max) };
    }));
    return { grid, max, peak: peakCell(cells) };
  });

  readonly playerCallRate = computed(() => {
    const totals = this.data()?.totals;
    return totals?.playerCalls ? Math.round((totals.playerCallsFilled / totals.playerCalls) * 100) : null;
  });

  ngOnInit(): void { this.load(); }

  setRange(value: Range): void {
    if (value === this.range()) return;
    this.range.set(value);
    this.load();
  }

  setMetric(value: Metric): void {
    this.metric.set(value);
    this.hovered.set(null);
  }

  load(): void {
    const days = this.range();
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    this.loading.set(true);
    this.error.set(false);
    this.hovered.set(null);
    this.stats.getSocialStats(this.iso(from), this.iso(to)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        this.users.resolve([...data.topPosts.map(post => post.authorId), ...data.topMembers.map(member => member.userId)]);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  tagChange(posts: number, previous: number): Delta | null { return changeOf(posts, previous); }

  sportLabel(sport: string | null): string { return sport ? SPORT_LABEL[sport] ?? sport : 'Chung'; }

  slotLabel(cell: { dayOfWeek: number; hour: number }): string {
    return `${WEEKDAY_LONG[cell.dayOfWeek - 1]} ${cell.hour}–${cell.hour + 1}h`;
  }

  cellLabel(cell: { dayOfWeek: number; hour: number; count: number }): string {
    return `${this.slotLabel(cell)}: ${this.count(cell.count)} hoạt động`;
  }

  /** "+28,8%" thay vì cả câu "so với kỳ trước" (cột hẹp); "Như cũ" khi không đổi. */
  shortChange(delta: Delta): string { return delta.tone === 'flat' ? 'Như cũ' : delta.text.split(' ')[0]; }

  /** Nhãn cột giờ: chỉ mốc 0, 6, 12, 18 để khỏi chen chúc. */
  hourTick(hour: number): string { return hour % 6 === 0 ? `${hour}h` : ''; }

  count(value: number | null | undefined): string { return new Intl.NumberFormat('vi-VN').format(value ?? 0); }

  decimal(value: number): string { return value.toLocaleString('vi-VN', { maximumFractionDigits: 1 }); }

  /** "T7, 12/09": thứ và ngày theo tiếng Việt (DatePipe của app không nạp locale vi). */
  dayLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .format(new Date(year, month - 1, day));
  }

  dayValue(day: Day, metric: Metric): number { return day[metric]; }

  /** Sparkline trong khung 100 × 32, chừa 3px trên dưới cho nét 2px (như trang Tổng quan). */
  sparkPath(values: number[]): string {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    return values.map((value, index) =>
      `${index ? 'L' : 'M'}${((index / (values.length - 1)) * 100).toFixed(2)},${(29 - ((value - min) / span) * 26).toFixed(2)}`
    ).join(' ');
  }

  private iso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
