import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BankAccount, BankDirectoryEntry } from '@application/dto/bank-account/bank-account.dto';
import { BANK_ACCOUNT_REPOSITORY_TOKEN, BankAccountRepository } from '@application/ports/persistence/bank-account.repository';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({ selector: 'app-owner-bank-account', standalone: true, imports: [CommonModule, FormsModule, LucideIconComponent], templateUrl: './owner-bank-account.component.html', styleUrl: './owner-bank-account.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class OwnerBankAccountComponent {
  private readonly repository: BankAccountRepository = inject(BANK_ACCOUNT_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  readonly banks = signal<BankDirectoryEntry[]>([]);
  readonly accounts = signal<BankAccount[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  bankBin = ''; accountNumber = ''; accountName = '';
  constructor() { this.load(); }
  bank(bin: string) { return this.banks().find(item => item.bin === bin); }
  load(): void {
    this.loading.set(true);
    forkJoin({ banks: this.repository.getBanks(), accounts: this.repository.getMyAccounts() })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { this.banks.set(result.banks); this.accounts.set(result.accounts); this.showForm.set(result.accounts.length === 0); },
        error: error => this.notify.error(error?.error?.message || 'Không thể tải tài khoản nhận doanh thu.')
      });
  }
  submit(): void {
    const number = this.accountNumber.replace(/\s/g, '');
    if (!this.bankBin || !/^\d{6,19}$/.test(number) || !this.accountName.trim()) { this.notify.warning('Vui lòng nhập đủ thông tin tài khoản.'); return; }
    this.saving.set(true);
    this.repository.link({ bankBin: this.bankBin, accountNumber: number, accountName: this.accountName.trim() })
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: account => { this.accounts.update(items => [account, ...items]); this.showForm.set(false); this.bankBin = ''; this.accountNumber = ''; this.accountName = ''; this.notify.success('Đã liên kết tài khoản nhận doanh thu.'); },
        error: error => this.notify.error(error?.error?.message || 'Không thể liên kết tài khoản.')
      });
  }
  makeDefault(account: BankAccount): void { this.repository.makeDefault(account.bankAccountId).subscribe({ next: updated => this.accounts.update(items => items.map(item => ({ ...item, isDefault: item.bankAccountId === updated.bankAccountId }))), error: error => this.notify.error(error?.error?.message || 'Không thể đổi tài khoản mặc định.') }); }
  disable(account: BankAccount): void { if (!window.confirm(`Gỡ tài khoản ****${account.accountNumberLast4}? Doanh thu sẽ bị giữ cho đến khi có tài khoản khác.`)) return; this.repository.disable(account.bankAccountId).subscribe({ next: () => { this.accounts.update(items => items.filter(item => item.bankAccountId !== account.bankAccountId)); this.notify.success('Đã gỡ tài khoản.'); }, error: error => this.notify.error(error?.error?.message || 'Không thể gỡ tài khoản.') }); }
  status(status: BankAccount['status']) { return { PENDING_VERIFICATION: 'Chờ payout xác minh', VERIFIED: 'Đã xác minh', REJECTED: 'Không hợp lệ', DISABLED: 'Đã tắt' }[status]; }
}
