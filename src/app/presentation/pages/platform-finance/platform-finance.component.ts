import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, filter, finalize, switchMap } from 'rxjs';
import {
  ADMIN_FINANCE_REPOSITORY_TOKEN, FinancePage, FinancePayment, FinancePayout, FinanceRefund, FinanceSummary,
  PaymentPurpose, PaymentStatus, PayoutKind, PayoutStatus, RefundStatus
} from '@application/ports/persistence/admin-finance.repository';
import { PAGE_SIZE } from '@shared/constants/page-size';
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

const PAYMENT_GROUPS: Readonly<Record<string, PaymentStatus[]>> = {
  '': [],
  collected: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  waiting: ['CREATED', 'PENDING'],
  unsuccessful: ['FAILED', 'CANCELLED', 'EXPIRED']
};
/** "Cần xử lý" trùng định nghĩa REFUNDS_NEEDING_ATTENTION của payment-service (con số trên thẻ KPI). */
const REFUND_GROUPS: Readonly<Record<string, RefundStatus[]>> = {
  attention: ['FAILED', 'MANUAL_REVIEW'],
  waiting: ['AWAITING_CLAIM', 'AWAITING_BANK_ACCOUNT'],
  processing: ['CREATED', 'PENDING', 'PROCESSING'],
  done: ['SUCCEEDED'],
  '': []
};
const PAYOUT_GROUPS: Readonly<Record<string, PayoutStatus[]>> = {
  attention: ['FAILED', 'MANUAL_REVIEW', 'CANCELLED'],
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
  FAILED: { label: 'Chi lỗi', tone: 'danger', hint: 'Đã hết lượt tự chi lại.' },
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
 * Tài chính toàn sàn: tiền thu, phí nền tảng, hoàn tiền và chi trả cho chủ sân trong kỳ. Admin chủ yếu theo dõi;
 * thao tác duy nhất là chi lại khoản hoàn đã hết lượt tự chi (trước đây chỉ người chơi tự bấm được). Chủ sân rút
 * tiền lỗi thì tiền tự về lại số dư của họ.
 */
@Component({
  selector: 'app-platform-finance',
  templateUrl: './platform-finance.component.html',
  styleUrls: ['./platform-finance.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent, SelectComponent,
    DatePickerComponent]
})
export class PlatformFinanceComponent implements OnInit {
  private readonly repository = inject(ADMIN_FINANCE_REPOSITORY_TOKEN);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly users = inject(UserDirectoryService);
  private request?: Subscription;
  private summaryRequest?: Subscription;

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
    { value: 'attention', label: 'Cần xử lý' }, { value: 'waiting', label: 'Chờ người chơi' },
    { value: 'processing', label: 'Đang chi' }, { value: 'done', label: 'Đã hoàn' }, { value: '', label: 'Tất cả' }
  ];
  readonly payoutKindOptions: readonly SelectOption[] = [
    { value: 'OWNER_WITHDRAWAL', label: 'Chủ sân rút tiền' }, { value: 'REFUND', label: 'Chi hoàn cho người chơi' }
  ];
  readonly payoutGroupOptions: readonly SelectOption[] = [
    { value: 'attention', label: 'Lỗi / chờ đối soát' }, { value: 'processing', label: 'Đang xử lý' },
    { value: 'done', label: 'Thành công' }, { value: '', label: 'Tất cả' }
  ];

  readonly tab = signal<Tab>('payments');
  readonly from = signal(isoDate(addDays(new Date(), -29)));
  readonly to = signal(this.today);
  readonly summary = signal<FinanceSummary | null>(null);
  readonly summaryError = signal<string | null>(null);

  readonly paymentGroup = signal('');
  readonly purpose = signal<PaymentPurpose | ''>('');
  readonly refundGroup = signal('attention');
  readonly payoutKind = signal<PayoutKind>('OWNER_WITHDRAWAL');
  readonly payoutGroup = signal('attention');

  readonly payments = signal<FinancePayment[]>([]);
  readonly refunds = signal<FinanceRefund[]>([]);
  readonly payouts = signal<FinancePayout[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly retrying = signal<string | null>(null);

  readonly attention = computed(() => (this.summary()?.refundsNeedingAttention ?? 0) + (this.summary()?.payoutsNeedingAttention ?? 0));

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'refunds' || tab === 'payouts') this.tab.set(tab);
    this.loadSummary();
    this.load();
  }

  setTab(tab: Tab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'payments' ? null : tab }, replaceUrl: true });
    this.reload();
  }

  /** Thẻ "Cần xử lý": mở đúng danh sách cần làm (hoàn tiền trước, vì có thao tác). */
  openAttention(): void {
    const summary = this.summary();
    this.refundGroup.set('attention');
    this.payoutGroup.set('attention');
    this.payoutKind.set('OWNER_WITHDRAWAL');
    if (summary && !summary.refundsNeedingAttention && summary.payoutsNeedingAttention) this.setTab('payouts');
    else if (this.tab() === 'refunds') this.reload();
    else this.setTab('refunds');
  }

  setPeriod(edge: 'from' | 'to', value: string): void {
    if (!value) return;
    (edge === 'from' ? this.from : this.to).set(value);
    this.loadSummary();
    if (this.tab() === 'payments') this.reload();
  }

  setFilter(target: 'paymentGroup' | 'purpose' | 'refundGroup' | 'payoutKind' | 'payoutGroup', value: string): void {
    (this[target] as WritableSignal<string>).set(value ?? '');
    this.reload();
  }

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
      this.request = this.fetch(this.repository.getRefunds(REFUND_GROUPS[this.refundGroup()], page, this.pageSize), done, result => {
        this.refunds.set(result.items);
        this.users.resolve(result.items.map(item => item.payerId));
      });
    } else {
      this.request = this.fetch(this.repository.getPayouts(this.payoutKind(), PAYOUT_GROUPS[this.payoutGroup()], page, this.pageSize), done,
        result => {
          this.payouts.set(result.items);
          this.users.resolve(result.items.map(item => item.payeeId));
        });
    }
  }

  retry(refund: FinanceRefund): void {
    this.confirm.ask({
      title: 'Chi lại khoản hoàn này?',
      message: `Hệ thống chuyển ${formatMoney(refund.amount)} về tài khoản ngân hàng mặc định của ${this.users.name(refund.payerId) || 'người chơi'} qua payOS. Thao tác được ghi vào nhật ký.`,
      confirmText: 'Chi lại',
      cancelText: 'Để sau'
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        this.retrying.set(refund.refundId);
        return this.repository.retryRefund(refund.refundId).pipe(finalize(() => this.retrying.set(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: updated => {
        this.notice.set(updated.status === 'SUCCEEDED'
          ? `Đã chi ${formatMoney(updated.amount)} cho ${this.users.name(updated.payerId) || 'người chơi'}.`
          : `Đã gửi lệnh chi lại ${formatMoney(updated.amount)}; trạng thái: ${this.refundStatus(updated.status).label.toLowerCase()}.`);
        this.reload();
        this.loadSummary();
      },
      error: err => this.error.set(err?.error?.message ?? 'Chưa chi lại được khoản hoàn.')
    });
  }

  paymentStatus(status: PaymentStatus) { return PAYMENT_META[status]; }
  refundStatus(status: RefundStatus) { return REFUND_META[status]; }
  payoutStatus(status: PayoutStatus) { return PAYOUT_META[status]; }
  purposeLabel(purpose: PaymentPurpose): string { return PURPOSE_LABEL[purpose]; }

  person(id: string | null): string {
    if (!id) return '—';
    return this.users.name(id) || 'Đang tải...';
  }

  private fetch<T>(source: Observable<FinancePage<T>>, done: () => void, apply: (page: FinancePage<T>) => void): Subscription {
    return source.pipe(finalize(done), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => { apply(page); this.total.set(page.total); },
      error: err => this.error.set(err?.error?.message ?? 'Không tải được dữ liệu tài chính.')
    });
  }
}
