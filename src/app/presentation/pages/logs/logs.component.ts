import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, Subscription, catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap } from 'rxjs';
import { Log } from '@application/dto/log/log.dto';
import { FailedLoginBurst, LogStatsResult } from '@application/dto/log/log-stats.dto';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { buildRsqlSearch } from '@presentation/shared/utils/api.helper';
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
  private readonly userRepository = inject(USER_REPOSITORY_TOKEN);
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
  /** Lọc nhanh: chỉ thao tác nhạy cảm (đổi quyền, khóa, đình chỉ, tiền, gửi hàng loạt, xuất dữ liệu). */
  readonly sensitive = signal(false);
  /** Đang xem một chuỗi sự kiện (cùng mã tương quan). */
  readonly correlation = signal('');
  readonly failedLogins = signal<FailedLoginBurst[]>([]);

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
    !!(this.keyword() || this.sensitive() || this.correlation() || this.source() || this.result() || this.fromDate() || this.toDate()));

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
    this.loadFailedLogins();
  }

  onKeyword(value: string): void { this.search$.next(value ?? ''); }


  clearFilters(): void {
    this.keyword.set('');
    this.sensitive.set(false);
    this.correlation.set('');
    this.source.set('');
    this.result.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.reload();
  }

  refresh(): void {
    this.load(true);
    this.loadStats();
    this.loadFailedLogins();
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
    const keyword = this.keyword();
    this.request = this.peopleMatching(keyword).pipe(
      switchMap(people => {
        // Mã hành động có trong số liệu hôm nay cũng tìm được theo mã (kể cả mã chưa có nhãn).
        const filter = buildLogFilter({
          query: keyword, people, sensitive: this.sensitive(), correlationId: this.correlation() || undefined,
          source: this.source(), result: this.result(), fromDate: this.fromDate(), toDate: this.toDate()
        }, this.stats()?.actions ?? []);
        return this.logService.getLogs({ page: this.pageIndex(), size: this.pageSize, filter: filter || undefined });
      }),
      finalize(() => { this.loading.set(false); this.paging.set(false); }), takeUntilDestroyed(this.destroyRef))
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

  /**
   * Tìm theo tên người: nhật ký lưu email (thao tác qua API) hoặc mã (sự kiện), nên tra tên / email ở auth-service
   * rồi tìm theo cả hai. Không tra được thì vẫn tìm theo từ khóa như cũ.
   */
  private peopleMatching(keyword: string): Observable<string[]> {
    if (keyword.trim().length < 2) return of([]);
    return this.userRepository.getUsers({ page: 0, size: 20, filter: buildRsqlSearch(keyword, ['fullName', 'email']) }).pipe(
      map(page => (page?.result ?? []).flatMap(user => [user.email, user.userId].filter((value): value is string => !!value))),
      catchError(() => of([]))
    );
  }

  loadFailedLogins(): void {
    this.logService.getFailedLoginBursts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: bursts => this.failedLogins.set(bursts),
      error: () => this.failedLogins.set([])
    });
  }

  toggleSensitive(): void {
    this.sensitive.update(value => !value);
    this.reload();
  }

  /** Từ popup chi tiết: xem mọi bản ghi cùng mã tương quan, theo thứ tự thời gian. */
  showChain(correlationId: string): void {
    this.correlation.set(correlationId);
    this.close();
    this.reload();
  }

  clearChain(): void {
    this.correlation.set('');
    this.reload();
  }

  /** Từ cảnh báo đăng nhập thất bại: lọc đúng tài khoản đó và các lần lỗi. */
  inspectAccount(account: string): void {
    this.keyword.set(account);
    this.result.set('error');
    this.reload();
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
