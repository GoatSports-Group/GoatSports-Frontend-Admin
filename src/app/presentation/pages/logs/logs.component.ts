import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { Log } from '@application/dto/log/log.dto';
import { LogStatsResult } from '@application/dto/log/log-stats.dto';
import { LogService } from '@presentation/services/log.service';
import { UserDirectoryService } from '@presentation/services/user-directory.service';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { LogResult, SOURCE_LABEL, actionLabel, buildLogFilter, resultOf, todayRange } from './logs.utils';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nhật ký hoạt động (audit trail): ai đã làm gì, lúc nào, kết quả ra sao. Số liệu hôm nay đếm ở audit-service;
 * danh sách lọc theo từ khóa, hành động, nguồn, kết quả và khoảng ngày (tự áp dụng, không cần bấm Tìm).
 */
@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, DatePickerComponent, LoadingSkeletonComponent, LucideIconComponent,
    PaginationComponent, SelectComponent]
})
export class LogsComponent implements OnInit {
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();
  readonly users = inject(UserDirectoryService);
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly actionLabel = actionLabel;
  readonly resultOf = resultOf;

  readonly keyword = signal('');
  readonly source = signal('');
  readonly result = signal<LogResult>('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly pageIndex = signal(0);

  readonly logs = signal<Log[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<LogStatsResult | null>(null);
  readonly statsError = signal(false);
  readonly selected = signal<Log | null>(null);
  readonly copied = signal(false);

  readonly sourceOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi nguồn' },
    ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))
  ];
  readonly resultOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi kết quả' }, { value: 'ok', label: 'Thành công' }, { value: 'error', label: 'Lỗi / bị từ chối' }
  ];
  readonly hasFilters = computed(() =>
    !!(this.keyword() || this.source() || this.result() || this.fromDate() || this.toDate()));

  /** Thao tác lỗi hôm nay (4xx + 5xx) và tỉ lệ. */
  readonly errorsToday = computed(() => {
    const stats = this.stats();
    if (!stats) return null;
    const count = stats.status4xx + stats.status5xx;
    return { count, rate: stats.totalRequests ? count / stats.totalRequests : 0 };
  });

  readonly hovered = signal<number | null>(null);

  /** 24 cột theo giờ (giờ máy) như biểu đồ trang Tổng quan: cao theo tỉ lệ với giờ nhiều nhất. */
  readonly hourly = computed(() => {
    const stats = this.stats();
    if (!stats) return { hours: [], max: 0, total: 0, peakHour: null as number | null };
    const values = stats.hourly.slice(0, 24);
    const max = Math.max(0, ...values);
    const currentHour = new Date().getHours();
    return {
      hours: values.map((value, hour) => ({
        hour, value, future: hour > currentHour,
        // Giờ có hoạt động luôn cao ít nhất 3% để vẫn thấy được cạnh giờ cao điểm.
        height: value && max ? Math.max(3, Math.round(value / max * 100)) : 0
      })),
      max,
      total: values.reduce((sum, value) => sum + value, 0),
      peakHour: max ? values.indexOf(max) : null
    };
  });

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
    this.loadStats();
  }

  onKeyword(value: string): void { this.search$.next(value ?? ''); }


  clearFilters(): void {
    this.keyword.set('');
    this.source.set('');
    this.result.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.reload();
  }

  refresh(): void {
    this.load(true);
    this.loadStats();
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  reload(): void {
    this.pageIndex.set(0);
    this.load();
  }

  load(keepList = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    (keepList ? this.paging : this.loading).set(true);
    // Mã hành động có trong số liệu hôm nay cũng tìm được theo mã (kể cả mã chưa có nhãn).
    const filter = buildLogFilter({
      query: this.keyword(), source: this.source(), result: this.result(), fromDate: this.fromDate(), toDate: this.toDate()
    }, this.stats()?.actions ?? []);
    this.request = this.logService.getLogs({ page: this.pageIndex(), size: this.pageSize, filter: filter || undefined })
      .pipe(finalize(() => { this.loading.set(false); this.paging.set(false); }), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          const items = page?.result ?? [];
          this.logs.set(items);
          this.total.set(page?.meta?.total ?? 0);
          this.users.resolve(items.map(item => item.userId).filter(id => UUID.test(id ?? '')));
        },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được nhật ký hoạt động.')
      });
  }

  loadStats(): void {
    const { from, to } = todayRange();
    this.logService.getStats(from, to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stats => { this.stats.set(stats); this.statsError.set(false); },
      error: () => this.statsError.set(true)
    });
  }

  /** Thao tác qua API ghi email; sự kiện ghi mã người dùng (tra tên theo lô). */
  actor(log: Log): { name: string; detail: string } {
    const id = log.userId?.trim();
    if (!id || id === 'anonymous') return { name: 'Khách / hệ thống', detail: '' };
    if (UUID.test(id)) return { name: this.users.name(id) || 'Đang tải...', detail: this.users.email(id) || id };
    return { name: id, detail: '' };
  }

  sourceLabel(log: Log): string {
    return SOURCE_LABEL[log.sourceService ?? ''] ?? log.sourceService ?? '—';
  }

  open(log: Log): void {
    this.copied.set(false);
    this.selected.set(log);
  }

  @HostListener('document:keydown.escape')
  close(): void { this.selected.set(null); }

  copy(value: string): void {
    navigator.clipboard?.writeText(value).then(() => this.copied.set(true), () => undefined);
  }
}
