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
import { ACTION_LABEL, LogResult, SOURCE_LABEL, actionLabel, buildLogFilter, resultOf, todayUtcRange } from './logs.utils';

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
  readonly action = signal('');
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
  /** Hành động đã biết + mọi mã xuất hiện hôm nay, xếp theo nhãn. */
  readonly actionOptions = computed<SelectOption[]>(() => {
    const codes = new Set([...Object.keys(ACTION_LABEL), ...(this.stats()?.actions ?? [])]);
    return [
      { value: '', label: 'Mọi hành động' },
      ...[...codes].map(value => ({ value, label: actionLabel(value) })).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
    ];
  });

  readonly hasFilters = computed(() =>
    !!(this.keyword() || this.action() || this.source() || this.result() || this.fromDate() || this.toDate()));

  /** Thao tác lỗi hôm nay (4xx + 5xx) và tỉ lệ. */
  readonly errorsToday = computed(() => {
    const stats = this.stats();
    if (!stats) return null;
    const count = stats.status4xx + stats.status5xx;
    return { count, rate: stats.totalRequests ? count / stats.totalRequests : 0 };
  });

  /** 24 cột theo giờ (giờ máy), cao theo tỉ lệ với giờ nhiều nhất. */
  readonly hourly = computed(() => {
    const stats = this.stats();
    if (!stats) return [];
    const { dayStart } = todayUtcRange();
    const max = Math.max(1, ...stats.hourly);
    const now = new Date();
    return stats.hourly.slice(0, 24).map((value, index) => {
      const at = new Date(dayStart.getTime() + index * 3_600_000);
      // Giờ có hoạt động luôn cao ít nhất 4% để vẫn nhìn thấy cạnh giờ cao điểm.
      return { hour: at.getHours(), value, height: value ? Math.max(4, Math.round(value / max * 100)) : 0, future: at > now };
    });
  });

  readonly peak = computed(() => Math.max(0, ...(this.stats()?.hourly ?? [])));

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
    this.loadStats();
  }

  onKeyword(value: string): void { this.search$.next(value ?? ''); }


  clearFilters(): void {
    this.keyword.set('');
    this.action.set('');
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
    const filter = buildLogFilter({
      query: this.keyword(), action: this.action(), source: this.source(), result: this.result(),
      fromDate: this.fromDate(), toDate: this.toDate()
    });
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
    const { from, to } = todayUtcRange();
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
