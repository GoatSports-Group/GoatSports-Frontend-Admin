import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { ConfirmService } from '@presentation/services/confirm.service';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { TwoWayWindow } from '@shared/utils/two-way-window';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, from, Observable } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BankAccount, BankDirectoryEntry, PayoutBalance, PayoutEarning, Withdrawal } from '@application/dto/bank-account/bank-account.dto';
import { EncryptedPayload } from '@application/dto/security/encrypted-payload.dto';
import { BANK_ACCOUNT_REPOSITORY_TOKEN, BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { NotifyService } from '@shared/components/notify/notify.service';
import { CryptoService } from '@presentation/services/crypto.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { InfiniteScrollDirective, LIST_CHUNK } from '@shared/directives/infinite-scroll.directive';

@Component({ selector: 'app-owner-bank-account', standalone: true, imports: [LoadingSkeletonComponent, CommonModule, FormsModule, LucideIconComponent, InfiniteScrollDirective, SelectComponent], templateUrl: './owner-bank-account.component.html', styleUrl: './owner-bank-account.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class OwnerBankAccountComponent {
  private readonly repository: BankAccountRepository = inject(BANK_ACCOUNT_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly cryptoService = inject(CryptoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmDialog = inject(ConfirmService);
  readonly banks = signal<BankDirectoryEntry[]>([]);
  readonly bankOptions = computed<SelectOption[]>(() => this.banks().map(item => ({ value: item.bin, label: `${item.shortName} — ${item.name}` })));
  readonly accounts = signal<BankAccount[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly balance = signal<PayoutBalance | null>(null);
  readonly withdrawals = signal<Withdrawal[]>([]);
  /** Lich su rut tien tra ve ca mang; chi render dan tung LIST_CHUNK dong khi cuon. */
  readonly withdrawalsShown = signal(LIST_CHUNK);
  readonly listChunk = LIST_CHUNK;
  readonly withdrawing = signal(false);
  readonly payoutAccount = computed(() => this.accounts().find(item => item.isDefault && (item.status === 'VERIFIED' || item.status === 'PENDING_VERIFICATION')));
  readonly canWithdraw = computed(() => { const balance = this.balance(); return !!balance && !!this.payoutAccount() && balance.available >= balance.minimumWithdrawal; });
  bankBin = ''; accountNumber = ''; accountName = '';
  /** Popup "Chi tiet so du": cong thuc so du + tung khoan thu (cuon vo han hai chieu, tai khi mo). */
  readonly balanceDetailOpen = signal(false);
  readonly earnings = signal<PayoutEarning[]>([]);
  readonly earningsLoading = signal(false);
  readonly earningsError = signal(false);
  readonly earningsWindow = new TwoWayWindow(this.earnings, earning => earning.paymentId, inject(Injector));
  private readonly earningsListRef = viewChild<ElementRef<HTMLElement>>('earningsList');
  constructor() { this.load(); }
  bank(bin: string) { return this.banks().find(item => item.bin === bin); }
  load(): void {
    this.loading.set(true);
    forkJoin({ banks: this.repository.getBanks(), accounts: this.repository.getMyAccounts(), balance: this.repository.getPayoutBalance(), withdrawals: this.repository.getWithdrawals() })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { this.banks.set(result.banks); this.accounts.set(result.accounts); this.balance.set(result.balance); this.withdrawals.set(result.withdrawals); },
        error: error => this.notify.error(error?.error?.message || 'Không thể tải tài khoản nhận doanh thu.')
      });
  }
  submit(): void {
    const number = this.accountNumber.replace(/\s/g, '');
    if (!this.bankBin || !/^\d{6,19}$/.test(number) || !this.accountName.trim()) { this.notify.warning('Vui lòng nhập đủ thông tin tài khoản.'); return; }
    this.saving.set(true);
    const request = { bankBin: this.bankBin, accountNumber: number, accountName: this.accountName.trim() };
    this.encryptBankingPayload(request).pipe(
      switchMap(encryptedPayload => this.repository.link(encryptedPayload)),
      finalize(() => this.saving.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: account => { this.accounts.update(items => [account, ...items]); this.showForm.set(false); this.bankBin = ''; this.accountNumber = ''; this.accountName = ''; this.notify.success('Đã liên kết tài khoản nhận doanh thu.'); },
      error: error => this.notify.error(error?.error?.message || 'Không thể liên kết tài khoản.')
    });
  }
  makeDefault(account: BankAccount): void {
    if (account.isDefault) return;
    this.encryptBankingPayload({ bankAccountId: account.bankAccountId }).pipe(
      switchMap(encryptedPayload => this.repository.makeDefault(encryptedPayload)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: updated => this.accounts.update(items => items.map(item => ({ ...item, isDefault: item.bankAccountId === updated.bankAccountId }))),
      error: error => this.notify.error(error?.error?.message || 'Không thể đổi tài khoản mặc định.')
    });
  }
  disable(account: BankAccount, confirmed = false): void {
    if (!confirmed) {
      this.confirmDialog.ask({
        title: `Gỡ tài khoản ****${account.accountNumberLast4}?`, confirmText: 'Gỡ tài khoản', confirmColor: 'warn',
        message: 'Doanh thu sẽ bị giữ cho đến khi bạn có tài khoản khác.'
      }).subscribe(ok => ok && this.disable(account, true));
      return;
    }
    this.encryptBankingPayload({ bankAccountId: account.bankAccountId }).pipe(
      switchMap(encryptedPayload => this.repository.disable(encryptedPayload)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => { this.accounts.update(items => items.filter(item => item.bankAccountId !== account.bankAccountId)); this.notify.success('Đã gỡ tài khoản.'); },
      error: error => this.notify.error(error?.error?.message || 'Không thể gỡ tài khoản.')
    });
  }
  openBalanceDetail(): void {
    this.balanceDetailOpen.set(true);
    this.loadEarnings();
  }

  loadEarnings(): void {
    this.earningsLoading.set(true);
    this.earningsError.set(false);
    this.repository.getEarnings().pipe(finalize(() => this.earningsLoading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => { this.earnings.set(items); this.earningsWindow.reset(); },
      error: () => this.earningsError.set(true)
    });
  }

  @HostListener('document:keydown.escape')
  closeDialogs(): void {
    if (this.saving()) return;
    this.balanceDetailOpen.set(false);
    this.showForm.set(false);
  }

  showMoreEarnings(): void { this.earningsWindow.next(this.earningsListRef()?.nativeElement); }
  showPreviousEarnings(): void { this.earningsWindow.previous(this.earningsListRef()?.nativeElement); }

  earningLabel(earning: PayoutEarning): string {
    return ({ BOOKING_DEPOSIT: 'Tiền cọc đặt sân', BOOKING_REMAINING: 'Thanh toán còn lại khi đặt sân', TOURNAMENT_FEE: 'Lệ phí giải đấu' } as Record<string, string>)[earning.purpose] ?? 'Khoản thu';
  }

  /** Ngay het giu tien (paidAt + holdDays) de chu san biet khi nao khoan nay rut duoc. */
  releaseDate(earning: PayoutEarning): Date {
    const date = new Date(earning.paidAt);
    date.setDate(date.getDate() + (this.balance()?.holdDays ?? 0));
    return date;
  }

  withdraw(confirmed = false): void {
    const balance = this.balance(); const account = this.payoutAccount();
    if (!balance || !account || !this.canWithdraw()) return;
    if (!confirmed) {
      this.confirmDialog.ask({
        title: 'Rút tiền?', confirmText: 'Rút tiền',
        message: `Rút ${this.money(balance.available)} về tài khoản ****${account.accountNumberLast4}.`
      }).subscribe(ok => ok && this.withdraw(true));
      return;
    }
    this.withdrawing.set(true);
    this.repository.withdraw().pipe(
      switchMap(withdrawal => forkJoin({ withdrawal: [withdrawal], balance: this.repository.getPayoutBalance(), withdrawals: this.repository.getWithdrawals() })),
      finalize(() => this.withdrawing.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.balance.set(result.balance); this.withdrawals.set(result.withdrawals);
        if (result.withdrawal.status === 'FAILED') this.notify.error(result.withdrawal.failureReason || 'payOS từ chối lệnh chuyển, tiền vẫn nằm trong số dư.');
        else this.notify.success(result.withdrawal.status === 'PAID' ? 'Đã chuyển tiền về tài khoản của bạn.' : 'Đã gửi lệnh rút, payOS đang xử lý.');
      },
      error: error => this.notify.error(error?.error?.message || 'Không thể rút tiền lúc này.')
    });
  }
  money(value: number | undefined): string { return new Intl.NumberFormat('vi-VN').format(value ?? 0) + ' ₫'; }
  withdrawalStatus(status: Withdrawal['status']) { return ({ PAID: 'Đã chuyển', FAILED: 'Thất bại', CANCELLED: 'Đã hủy' } as Record<string, string>)[status] ?? 'Đang xử lý'; }
  status(status: BankAccount['status']) { return { PENDING_VERIFICATION: 'Chờ payout xác minh', VERIFIED: 'Đã xác minh', REJECTED: 'Không hợp lệ', DISABLED: 'Đã tắt' }[status]; }
  private encryptBankingPayload(payload: object): Observable<EncryptedPayload> {
    return this.repository.getEncryptionPublicKey().pipe(
      switchMap(publicKey => from(this.cryptoService.encryptPayload(payload, publicKey)))
    );
  }
}
