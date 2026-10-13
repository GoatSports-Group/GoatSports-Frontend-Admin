import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, debounceTime, distinctUntilChanged, filter, finalize, map, of, switchMap } from 'rxjs';
import {
  ADMIN_FINANCE_REPOSITORY_TOKEN, FinancePage, FinancePayment, FinancePayout, FinanceRefund, FinanceSummary,
  PaymentPurpose, PaymentStatus, PayoutKind, PayoutQuery, PayoutStatus, RefundQuery, RefundStatus
} from '@application/ports/persistence/admin-finance.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { buildRsqlSearch } from '@shared/utils/api.helper';
import { ExportFormatOption, ReportExportsComponent } from '@shared/components/report-exports/report-exports.component';
import { ReportExportFormat } from '@application/ports/persistence/report-export.repository';
import { ConfirmService } from '@presentation/services/confirm.service';
import { UserDirectoryService } from '@presentation/services/user-directory.service';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { addDays, formatMoney, isoDate } from '../owner-tournaments/tournament-labels';

type Tab = 'payments' | 'refunds' | 'payouts';
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
/** Chi tiết một dòng: khoản hoàn tải thêm lượt chi payOS gắn với nó ({@code payout} undefined = đang tải). */
type Detail =
  | { kind: 'refund'; refund: FinanceRefund; payout: FinancePayout | null | undefined }
  | { kind: 'payout'; payout: FinancePayout };

/** Báo cáo dựng ở report-service bằng Jasper: Excel để đối soát, PDF để xem trước / in. */
const EXPORT_FORMATS: readonly ExportFormatOption[] = [
  { value: 'xlsx', label: 'Excel · danh sách', hint: 'Mỗi khoản một dòng: người nhận, số tiền, trạng thái, mã giao dịch; lọc và đối soát tiếp được.', icon: 'file-spreadsheet' },
  { value: 'pdf', label: 'PDF · xem trước, in', hint: 'Cùng danh sách, có tổng số khoản và tổng tiền; mở xem trước ở tab mới.', icon: 'file-text' }
];
const EXPORT_KINDS = {
  FINANCE_REFUNDS: { label: 'Hoàn tiền', unit: 'khoản hoàn' },
  FINANCE_PAYOUTS: { label: 'Chi trả', unit: 'lượt chi' }
} as const;

/** Trùng REMIND_COOLDOWN_HOURS của payment-service: trong khoảng này nút "Nhắc" tắt. */
const REMIND_COOLDOWN_MS = 24 * 3_600_000;
/** Trùng STALE_AFTER_DAYS của payment-service (thẻ "Treo quá 7 ngày"). */
const STALE_DAYS = '7';

const PAYMENT_GROUPS: Readonly<Record<string, PaymentStatus[]>> = {
  '': [],
  collected: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  waiting: ['CREATED', 'PENDING'],
  unsuccessful: ['FAILED', 'CANCELLED', 'EXPIRED']
};
/**
 * "Cần xử lý" trùng REFUNDS_NEEDING_ATTENTION của payment-service (con số trên thẻ KPI); "Chưa xong" trùng
 * REMINDABLE_REFUNDS (khoản đang chờ một người, nhắc được).
 */
const REFUND_GROUPS: Readonly<Record<string, RefundStatus[]>> = {
  attention: ['FAILED', 'MANUAL_REVIEW'],
  open: ['AWAITING_CLAIM', 'AWAITING_BANK_ACCOUNT', 'FAILED', 'MANUAL_REVIEW'],
  waiting: ['AWAITING_CLAIM', 'AWAITING_BANK_ACCOUNT'],
  processing: ['CREATED', 'PENDING', 'PROCESSING'],
  done: ['SUCCEEDED'],
  '': []
};
/** Chi trả chỉ để tra cứu: lượt rút lỗi thì tiền đã về số dư chủ sân, chủ sân tự rút lại (admin không làm gì). */
const PAYOUT_GROUPS: Readonly<Record<string, PayoutStatus[]>> = {
  failed: ['FAILED', 'CANCELLED'],
  processing: ['PENDING', 'PROCESSING'],
  done: ['SUCCEEDED'],
  '': []
};

export const PURPOSE_LABEL: Readonly<Record<PaymentPurpose, string>> = {
  BOOKING_DEPOSIT: 'Đặt cọc sân', BOOKING_REMAINING: 'Tiền sân còn lại', TOURNAMENT_FEE: 'Lệ phí giải đấu'
};

const PAYMENT_META: Readonly<Record<PaymentStatus, { label: string; tone: Tone }>> = {
  CREATED: { label: 'Mới tạo', tone: 'neutral' },
  PENDING: { label: 'Chờ thanh toán', tone: 'info' },
  SUCCEEDED: { label: 'Đã thu', tone: 'success' },
  FAILED: { label: 'Thất bại', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  PARTIALLY_REFUNDED: { label: 'Hoàn một phần', tone: 'warning' },
  REFUNDED: { label: 'Đã hoàn', tone: 'warning' }
};

const REFUND_META: Readonly<Record<RefundStatus, { label: string; tone: Tone; hint?: string }>> = {
  CREATED: { label: 'Mới tạo', tone: 'neutral' },
  AWAITING_CLAIM: { label: 'Chờ người chơi nhận', tone: 'info', hint: 'Người chơi bấm "Nhận hoàn tiền" trong ứng dụng.' },
  AWAITING_BANK_ACCOUNT: { label: 'Chờ liên kết ngân hàng', tone: 'info', hint: 'Người chơi liên kết tài khoản thì hệ thống tự chi.' },
  PENDING: { label: 'Đang chờ chi', tone: 'info' },
  PROCESSING: { label: 'Đang chi', tone: 'info' },
  SUCCEEDED: { label: 'Đã hoàn', tone: 'success' },
  FAILED: { label: 'Chi lỗi', tone: 'danger', hint: 'Đã hết lượt tự chi lại; người chơi vẫn tự bấm "Thử lại" được.' },
  MANUAL_REVIEW: { label: 'Chờ chủ sân hoàn tay', tone: 'warning', hint: 'Thanh toán tiền mặt: chủ sân hoàn và xác nhận mã giao dịch.' }
};

const PAYOUT_META: Readonly<Record<PayoutStatus, { label: string; tone: Tone }>> = {
  PENDING: { label: 'Chờ gửi', tone: 'info' },
  PROCESSING: { label: 'Đang chuyển', tone: 'info' },
  SUCCEEDED: { label: 'Thành công', tone: 'success' },
  FAILED: { label: 'Thất bại', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  MANUAL_REVIEW: { label: 'Chờ đối soát', tone: 'warning' }
};

/**
 * Tài chính toàn sàn: tiền thu, phí nền tảng, hoàn tiền và chi trả cho chủ sân trong kỳ. Người nhận tự gỡ phần lớn
 * khoản lỗi (người chơi bấm "Thử lại", chủ sân rút lại), nên admin không chi lại từng khoản mà chủ yếu giám sát: tìm
 * và xem chi tiết, nhắc khoản treo lâu, chi lại hàng loạt khi lỗi do phía nền tảng (vd. payOS hết số dư) và xuất CSV.
 */
@Component({
  selector: 'app-platform-finance',
  templateUrl: './platform-finance.component.html',
  styleUrls: ['./platform-finance.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent, SelectComponent,
    DatePickerComponent, ReportExportsComponent]
})
export class PlatformFinanceComponent implements OnInit {
  private readonly repository = inject(ADMIN_FINANCE_REPOSITORY_TOKEN);
  private readonly userRepository = inject(USER_REPOSITORY_TOKEN);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly users = inject(UserDirectoryService);
  private request?: Subscription;
  private summaryRequest?: Subscription;
  private detailRequest?: Subscription;
  private readonly search$ = new Subject<string>();

  readonly pageSize = PAGE_SIZE.table;
  readonly today = isoDate(new Date());
  readonly money = formatMoney;

  readonly paymentStatusOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi trạng thái' }, { value: 'collected', label: 'Đã thu' },
    { value: 'waiting', label: 'Chờ thanh toán' }, { value: 'unsuccessful', label: 'Không thành công' }
  ];
  readonly purposeOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi khoản' },
    ...(Object.keys(PURPOSE_LABEL) as PaymentPurpose[]).map(value => ({ value, label: PURPOSE_LABEL[value] }))
  ];
  readonly refundGroupOptions: readonly SelectOption[] = [
    { value: 'attention', label: 'Cần xử lý' }, { value: 'open', label: 'Chưa xong' },
    { value: 'waiting', label: 'Chờ người chơi' }, { value: 'processing', label: 'Đang chi' },
    { value: 'done', label: 'Đã hoàn' }, { value: '', label: 'Tất cả' }
  ];
  readonly ageOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi lúc' }, { value: '3', label: 'Tạo quá 3 ngày' }, { value: '7', label: 'Tạo quá 7 ngày' },
    { value: '14', label: 'Tạo quá 14 ngày' }, { value: '30', label: 'Tạo quá 30 ngày' }
  ];
  readonly payoutKindOptions: readonly SelectOption[] = [
    { value: 'OWNER_WITHDRAWAL', label: 'Chủ sân rút tiền' }, { value: 'REFUND', label: 'Chi hoàn cho người chơi' }
  ];
  readonly payoutGroupOptions: readonly SelectOption[] = [
    { value: '', label: 'Tất cả' }, { value: 'failed', label: 'Lỗi / đã hủy' },
    { value: 'processing', label: 'Đang xử lý' }, { value: 'done', label: 'Thành công' }
  ];

  readonly tab = signal<Tab>('payments');
  readonly from = signal(isoDate(addDays(new Date(), -29)));
  readonly to = signal(this.today);
  readonly summary = signal<FinanceSummary | null>(null);
  readonly summaryError = signal<string | null>(null);

  readonly paymentGroup = signal('');
  readonly purpose = signal<PaymentPurpose | ''>('');
  readonly refundGroup = signal('attention');
  readonly refundAge = signal('');
  readonly payoutKind = signal<PayoutKind>('OWNER_WITHDRAWAL');
  readonly payoutGroup = signal('');
  /** Từ khóa (lý do, mã đặt sân, chủ tài khoản) và mã người dùng khớp tên/email của nó. */
  readonly keyword = signal('');
  private people: string[] = [];

  readonly payments = signal<FinancePayment[]>([]);
  readonly refunds = signal<FinanceRefund[]>([]);
  readonly payouts = signal<FinancePayout[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  /** Lỗi của một thao tác (chi lại, nhắc, xuất): báo phía trên bảng, không thay bảng bằng màn lỗi. */
  readonly actionError = signal<string | null>(null);
  readonly reminding = signal<string | null>(null);
  readonly bulkRetrying = signal(false);
  readonly detail = signal<Detail | null>(null);

  readonly exportFormats = EXPORT_FORMATS;
  readonly exportKinds = EXPORT_KINDS;
  readonly exportTypes = Object.keys(EXPORT_KINDS);
  /** Nhóm / loại đang lọc, in lên báo cáo và hiện để xác nhận trước khi xuất. */
  readonly exportScopeLabel = computed(() => {
    if (this.tab() === 'payouts') {
      return `${label(this.payoutKindOptions, this.payoutKind())} · ${label(this.payoutGroupOptions, this.payoutGroup())}`;
    }
    return label(this.refundGroupOptions, this.refundGroup());
  });
  readonly exportScope = computed(() => {
    const scope = [`${shortDate(this.from())} – ${shortDate(this.to())}`, this.exportScopeLabel()];
    if (this.tab() === 'refunds' && this.refundAge()) scope.push(label(this.ageOptions, this.refundAge()));
    if (this.keyword()) scope.push(`"${this.keyword()}"`);
    return scope;
  });
  /** Xuất đúng danh sách đang xem (mọi trang), trong kỳ "Từ ngày – Đến ngày" ở đầu trang. */
  readonly exportRequest = (format: ReportExportFormat) => this.repository.requestExport(this.tab() === 'payouts'
    ? { kind: 'PAYOUTS', query: this.payoutQuery(), from: this.from(), to: this.to(), format, scopeLabel: this.exportScopeLabel() }
    : { kind: 'REFUNDS', query: this.refundQuery(), from: this.from(), to: this.to(), format, scopeLabel: this.exportScopeLabel() });

  /** "Cần xử lý" chỉ gồm việc admin làm được: khoản hoàn chi lỗi (Chi lại tất cả) và chờ chủ sân hoàn tay (Nhắc). */
  readonly attention = computed(() => this.summary()?.refundsNeedingAttention ?? 0);
  readonly manualRefunds = computed(() => Math.max(0, this.attention() - (this.summary()?.failedRefunds ?? 0)));
  /**
   * Thẻ "Cần xử lý" / "Treo quá 7 ngày" đếm mọi lúc (để khoản kẹt lâu không bị khuất), còn danh sách theo kỳ: số khoản
   * của hàng đợi đó nằm ngoài kỳ đang chọn.
   */
  readonly outsidePeriod = computed(() => {
    const summary = this.summary();
    if (!summary || this.tab() !== 'refunds' || this.keyword() || this.loading() || this.error()) return 0;
    const queue = this.refundGroup() === 'attention' && !this.refundAge() ? summary.refundsNeedingAttention
      : this.refundGroup() === 'open' && this.refundAge() === STALE_DAYS ? summary.staleRefunds : null;
    return queue === null ? 0 : Math.max(0, queue - this.total());
  });

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'refunds' || tab === 'payouts') this.tab.set(tab);
    // Tìm người theo tên/email ở auth-service rồi gửi kèm mã cho payment-service (nó không giữ tên).
    this.search$.pipe(
      debounceTime(300),
      map(value => value.trim()),
      distinctUntilChanged(),
      switchMap(value => (value ? this.findPeople(value) : of([])).pipe(map(people => ({ value, people })))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ value, people }) => {
      this.keyword.set(value);
      this.people = people;
      this.reload();
    });
    this.loadSummary();
    this.load();
  }

  setTab(tab: Tab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'payments' ? null : tab }, replaceUrl: true });
    this.reload();
  }

  /** Thẻ "Cần xử lý": khoản hoàn chi lỗi / chờ chủ sân hoàn tay. */
  openAttention(): void {
    this.refundGroup.set('attention');
    this.refundAge.set('');
    this.openRefunds();
  }

  /** Thẻ "Treo quá 7 ngày": khoản đang chờ người nhận, tạo quá 7 ngày, để nhắc. */
  openStale(): void {
    this.refundGroup.set('open');
    this.refundAge.set(STALE_DAYS);
    this.openRefunds();
  }

  setPeriod(edge: 'from' | 'to', value: string): void {
    if (!value) return;
    (edge === 'from' ? this.from : this.to).set(value);
    this.loadSummary();
    this.reload();
  }

  setFilter(target: 'paymentGroup' | 'purpose' | 'refundGroup' | 'refundAge' | 'payoutKind' | 'payoutGroup', value: string): void {
    (this[target] as WritableSignal<string>).set(value ?? '');
    this.reload();
  }

  onKeyword(value: string): void { this.search$.next(value ?? ''); }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  reload(): void {
    this.pageIndex.set(0);
    this.load();
  }

  loadSummary(): void {
    this.summaryRequest?.unsubscribe();
    this.summaryError.set(null);
    this.summaryRequest = this.repository.getSummary(this.from(), this.to())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: summary => this.summary.set(summary),
        error: err => this.summaryError.set(err?.error?.message ?? 'Không tải được số liệu tài chính.')
      });
  }

  load(keepList = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    (keepList ? this.paging : this.loading).set(true);
    const page = this.pageIndex();
    const done = () => { this.loading.set(false); this.paging.set(false); };
    const tab = this.tab();
    if (tab === 'payments') {
      this.request = this.fetch(this.repository.getPayments({
        statuses: PAYMENT_GROUPS[this.paymentGroup()], purposes: this.purpose() ? [this.purpose() as PaymentPurpose] : [],
        from: this.from(), to: this.to(), page, size: this.pageSize
      }), done, result => {
        this.payments.set(result.items);
        this.users.resolve(result.items.map(item => item.payerId));
      });
    } else if (tab === 'refunds') {
      this.request = this.fetch(this.repository.getRefunds(this.refundQuery(), page, this.pageSize), done, result => {
        this.refunds.set(result.items);
        this.users.resolve(result.items.map(item => item.payerId));
      });
    } else {
      this.request = this.fetch(this.repository.getPayouts(this.payoutQuery(), page, this.pageSize), done, result => {
        this.payouts.set(result.items);
        this.users.resolve(result.items.map(item => item.payeeId));
      });
    }
  }

  /** Lỗi do phía nền tảng (vd. tài khoản payOS hết số dư) làm hỏng nhiều khoản cùng lúc: chi lại một lượt. */
  retryAllFailed(): void {
    const count = this.summary()?.failedRefunds ?? 0;
    this.confirm.ask({
      title: `Chi lại ${count} khoản hoàn đang lỗi?`,
      message: 'Hệ thống chuyển lại từng khoản qua payOS (tối đa 100 khoản cũ nhất mỗi lượt). Nếu lỗi do tài khoản payOS hết số dư, hãy nạp tiền trước. Thao tác được ghi vào nhật ký.',
      confirmText: 'Chi lại tất cả',
      cancelText: 'Để sau'
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        this.bulkRetrying.set(true);
        this.actionError.set(null);
        return this.repository.retryFailedRefunds().pipe(finalize(() => this.bulkRetrying.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.notice.set(result.attempted
          ? `Đã thử ${result.attempted} khoản: ${result.succeeded} thành công, ${result.processing} đang chuyển, ${result.failed} vẫn lỗi.`
          : 'Không còn khoản hoàn nào đang lỗi.');
        this.refreshAfterAction();
      },
      error: err => this.actionError.set(err?.error?.message ?? 'Chưa chi lại được các khoản hoàn lỗi.')
    });
  }

  /** Khoản tiền mặt: nhắc chủ sân hoàn tay; còn lại: nhắc người chơi nhận / liên kết ngân hàng / thử lại. */
  remind(refund: FinanceRefund): void {
    const toOwner = refund.status === 'MANUAL_REVIEW';
    const who = toOwner ? 'chủ sân' : (this.users.name(refund.payerId) || 'người chơi');
    this.confirm.ask({
      title: 'Gửi nhắc nhở?',
      message: toOwner
        ? `Chủ sân nhận thông báo: khách đang chờ hoàn ${formatMoney(refund.amount)} tiền mặt, cần hoàn và nhập mã giao dịch.`
        : `${who} nhận thông báo về khoản hoàn ${formatMoney(refund.amount)} đang chờ (${this.refundStatus(refund.status).label.toLowerCase()}). Mỗi khoản nhắc tối đa một lần trong 24 giờ.`,
      confirmText: 'Gửi nhắc',
      cancelText: 'Để sau'
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        this.reminding.set(refund.refundId);
        this.actionError.set(null);
        return this.repository.remindRefund(refund.refundId).pipe(finalize(() => this.reminding.set(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: updated => {
        this.notice.set(`Đã gửi nhắc cho ${who}.`);
        this.refunds.update(items => items.map(item => item.refundId === updated.refundId ? updated : item));
        const detail = this.detail();
        if (detail?.kind === 'refund' && detail.refund.refundId === updated.refundId) this.detail.set({ ...detail, refund: updated });
      },
      error: err => this.actionError.set(err?.error?.message ?? 'Chưa gửi được nhắc nhở.')
    });
  }

  /** Nhắc gần đây (trong 24 giờ) thì tắt nút; backend vẫn chặn nếu client lệch giờ. */
  recentlyReminded(refund: FinanceRefund): boolean {
    return !!refund.lastRemindedAt && Date.now() - new Date(refund.lastRemindedAt).getTime() < REMIND_COOLDOWN_MS;
  }

  openRefund(refund: FinanceRefund): void {
    this.detailRequest?.unsubscribe();
    this.detail.set({ kind: 'refund', refund, payout: undefined });
    this.detailRequest = this.repository.getRefund(refund.refundId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => this.detail.set({ kind: 'refund', refund: detail.refund, payout: detail.payout }),
      error: () => this.detail.set({ kind: 'refund', refund, payout: null })
    });
  }

  openPayout(payout: FinancePayout): void {
    this.detail.set({ kind: 'payout', payout });
  }

  closeDetail(): void {
    this.detailRequest?.unsubscribe();
    this.detail.set(null);
  }

  paymentStatus(status: PaymentStatus) { return PAYMENT_META[status]; }
  refundStatus(status: RefundStatus) { return REFUND_META[status]; }
  payoutStatus(status: PayoutStatus) { return PAYOUT_META[status]; }
  purposeLabel(purpose: PaymentPurpose): string { return PURPOSE_LABEL[purpose]; }

  person(id: string | null): string {
    if (!id) return '—';
    return this.users.name(id) || 'Đang tải...';
  }

  private openRefunds(): void {
    if (this.tab() === 'refunds') this.reload();
    else this.setTab('refunds');
  }

  private refreshAfterAction(): void {
    this.load(true);
    this.loadSummary();
  }

  private refundQuery(): RefundQuery {
    return {
      statuses: REFUND_GROUPS[this.refundGroup()], from: this.from(), to: this.to(), keyword: this.keyword(), people: this.people,
      olderThanDays: this.refundAge() ? Number(this.refundAge()) : undefined
    };
  }

  private payoutQuery(): PayoutQuery {
    return {
      kind: this.payoutKind(), statuses: PAYOUT_GROUPS[this.payoutGroup()], from: this.from(), to: this.to(),
      keyword: this.keyword(), people: this.people
    };
  }

  /** Tối đa 50 người khớp tên/email; tra lỗi (vd. thiếu quyền xem người dùng) thì chỉ tìm theo chữ. */
  private findPeople(keyword: string): Observable<string[]> {
    return this.userRepository.getUsers({ page: 0, size: 50, filter: buildRsqlSearch(keyword, ['fullName', 'email']) }).pipe(
      map(page => page?.result?.map(user => user.userId) ?? []),
      catchError(() => of([]))
    );
  }

  private fetch<T>(source: Observable<FinancePage<T>>, done: () => void, apply: (page: FinancePage<T>) => void): Subscription {
    return source.pipe(finalize(done), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => { apply(page); this.total.set(page.total); },
      error: err => this.error.set(err?.error?.message ?? 'Không tải được dữ liệu tài chính.')
    });
  }
}

function label(options: readonly SelectOption[], value: string): string {
  return options.find(option => option.value === value)?.label ?? '';
}

/** 2026-10-01 → 01/10/2026. */
function shortDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
