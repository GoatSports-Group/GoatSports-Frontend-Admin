import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityStats, PlatformBookingStats, PlatformUserStats } from '@application/dto/admin-stats/admin-stats.dto';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

type Range = 7 | 30 | 90;
type Section<T> = { loading: boolean; error: boolean; data: T | null };

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã nhận sân', COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy', REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền', EXPIRED: 'Hết hạn'
};

/**
 * Tổng quan toàn nền tảng cho admin. Ba nguồn tải độc lập (người dùng, đặt sân, CLB/giải), một nguồn lỗi
 * chỉ làm hỏng ô của nó. Số liệu đặt sân tính theo ngày tạo đơn trong kỳ đã chọn.
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
  private readonly repository = inject(ADMIN_STATS_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  /** Đơn đăng ký chủ sân đang chờ duyệt (trang cha đã tải). */
  @Input() pendingApplications = 0;

  readonly ranges: readonly Range[] = [7, 30, 90];
  readonly range = signal<Range>(30);
  readonly users = signal<Section<PlatformUserStats>>({ loading: true, error: false, data: null });
  readonly bookings = signal<Section<PlatformBookingStats>>({ loading: true, error: false, data: null });
  readonly community = signal<Section<CommunityStats>>({ loading: true, error: false, data: null });
  readonly hovered = signal<number | null>(null);

  readonly cancelRate = computed(() => {
    const data = this.bookings().data;
    if (!data?.bookings) return null;
    const lost = (data.bookingsByStatus['CANCELLED'] ?? 0) + (data.bookingsByStatus['EXPIRED'] ?? 0)
      + (data.bookingsByStatus['REFUNDED'] ?? 0) + (data.bookingsByStatus['REFUND_PENDING'] ?? 0);
    return Math.round((lost / data.bookings) * 1000) / 10;
  });

  readonly liveTournaments = computed(() => {
    const byStatus = this.community().data?.tournamentsByStatus;
    return byStatus ? (byStatus['REGISTRATION_OPEN'] ?? 0) + (byStatus['IN_PROGRESS'] ?? 0) : 0;
  });

  /** Cột theo ngày: chiều cao theo số đơn, trần là ngày nhiều đơn nhất (tối thiểu 1 để tránh chia 0). */
  readonly bars = computed(() => {
    const days = this.bookings().data?.byDay ?? [];
    const max = Math.max(1, ...days.map(day => day.bookings));
    return { max, days: days.map(day => ({ ...day, height: (day.bookings / max) * 100 })) };
  });

  readonly statusRows = computed(() => {
    const data = this.bookings().data;
    if (!data) return [];
    const max = Math.max(1, ...Object.values(data.bookingsByStatus));
    return Object.entries(data.bookingsByStatus)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ label: BOOKING_STATUS_LABEL[status] ?? status, count, width: (count / max) * 100 }));
  });

  ngOnInit(): void { this.load(); }

  setRange(value: Range): void {
    if (value === this.range()) return;
    this.range.set(value);
    this.loadRanged();
  }

  load(): void {
    this.loadRanged();
    this.community.set({ loading: true, error: false, data: this.community().data });
    this.repository.getCommunityStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.community.set({ loading: false, error: false, data }),
      error: () => this.community.set({ loading: false, error: true, data: null })
    });
  }

  private loadRanged(): void {
    const to = new Date();
    const from = new Date(to.getTime() - (this.range() - 1) * 86_400_000);
    const [fromDate, toDate] = [this.iso(from), this.iso(to)];
    this.users.set({ loading: true, error: false, data: this.users().data });
    this.bookings.set({ loading: true, error: false, data: this.bookings().data });
    this.repository.getUserStats(fromDate, toDate).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.users.set({ loading: false, error: false, data }),
      error: () => this.users.set({ loading: false, error: true, data: null })
    });
    this.repository.getBookingStats(fromDate, toDate).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.bookings.set({ loading: false, error: false, data }),
      error: () => this.bookings.set({ loading: false, error: true, data: null })
    });
  }

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

  private iso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
