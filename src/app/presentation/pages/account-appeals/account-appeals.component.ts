import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import { AccountAppeal, AccountAppealStatus } from '@application/dto/account-appeal/account-appeal.dto';
import { ACCOUNT_APPEAL_REPOSITORY_TOKEN } from '@application/ports/persistence/account-appeal.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { UserDirectoryService } from '@presentation/services/user-directory.service';

export type AppealTab = 'NEW' | 'ALL' | 'RESOLVED';

const TAB_STATUS: Record<AppealTab, AccountAppealStatus | null> = { NEW: 'NEW', ALL: null, RESOLVED: 'RESOLVED' };
export const STATUS_LABEL: Record<AccountAppealStatus, { label: string; tone: string }> = {
  NEW: { label: 'Chưa đọc', tone: 'primary' },
  READ: { label: 'Đã đọc', tone: 'neutral' },
  RESOLVED: { label: 'Đã xử lý', tone: 'success' }
};
const PAGE_SIZE = 20;
const REPLY_MAX = 4000;

/**
 * Hộp thư khiếu nại của tài khoản bị khóa (gửi từ màn đăng nhập, sau khi nhập đúng mật khẩu): đọc như email, trả lời
 * qua email người gửi, mở khóa tài khoản ngay tại thư, đánh dấu đã xử lý. Bản sao thư cũng tới hộp thư hỗ trợ.
 */
@Component({
  selector: 'app-account-appeals',
  templateUrl: './account-appeals.component.html',
  styleUrls: ['./account-appeals.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent]
})
export class AccountAppealsComponent implements OnInit {
  private readonly repository = inject(ACCOUNT_APPEAL_REPOSITORY_TOKEN);
  private readonly users = inject(USER_REPOSITORY_TOKEN);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly directory = inject(UserDirectoryService);
  private listRequest?: Subscription;

  readonly pageSize = PAGE_SIZE;
  readonly replyMax = REPLY_MAX;
  readonly statusLabel = STATUS_LABEL;
  readonly tab = signal<AppealTab>('NEW');
  readonly page = signal(0);
  readonly appeals = signal<AccountAppeal[]>([]);
  readonly total = signal(0);
  readonly unread = signal<number | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selected = signal<AccountAppeal | null>(null);
  readonly opening = signal(false);
  readonly busy = signal(false);
  readonly notice = signal<{ text: string; tone: 'success' | 'warning' } | null>(null);
  reply = '';
  resolveAfterReply = true;

  readonly selectedId = computed(() => this.selected()?.appealId ?? null);
  readonly replyLength = computed(() => this.replyText().trim().length);
  private readonly replyText = signal('');

  ngOnInit(): void {
    this.load();
  }

  selectTab(tab: AppealTab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.listRequest = this.repository.list(TAB_STATUS[this.tab()], this.page(), PAGE_SIZE)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.appeals.set(result.items);
          this.total.set(result.total);
        },
        error: (err: HttpErrorResponse) => this.error.set(this.message(err, 'Chưa tải được hộp thư.'))
      });
    this.refreshUnread();
  }

  open(appeal: AccountAppeal): void {
    this.selected.set(appeal);
    this.setReply('');
    this.opening.set(true);
    this.repository.open(appeal.appealId)
      .pipe(finalize(() => this.opening.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: opened => {
          this.selected.set(opened);
          this.replace(opened);
          if (opened.repliedBy) this.directory.resolve([opened.repliedBy]);
          if (appeal.status === 'NEW') this.refreshUnread();
        },
        error: (err: HttpErrorResponse) => this.flash(this.message(err, 'Chưa mở được thư.'), 'warning')
      });
  }

  closeReader(): void {
    this.selected.set(null);
  }

  setReply(value: string): void {
    this.reply = value;
    this.replyText.set(value);
  }

  sendReply(): void {
    const appeal = this.selected();
    const text = this.reply.trim();
    if (!appeal || !text || text.length > REPLY_MAX || this.busy()) return;
    this.busy.set(true);
    this.repository.reply(appeal.appealId, text, this.resolveAfterReply)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.afterUpdate({ ...updated, accountStatus: appeal.accountStatus });
          this.setReply('');
          this.flash(`Đã gửi phản hồi tới ${appeal.email}.`, 'success');
        },
        error: (err: HttpErrorResponse) => this.flash(this.message(err, 'Chưa gửi được phản hồi.'), 'warning')
      });
  }

  markResolved(): void {
    const appeal = this.selected();
    if (!appeal || this.busy()) return;
    this.busy.set(true);
    this.repository.changeStatus(appeal.appealId, 'RESOLVED')
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => this.afterUpdate({ ...updated, accountStatus: appeal.accountStatus }),
        error: (err: HttpErrorResponse) => this.flash(this.message(err, 'Chưa cập nhật được thư.'), 'warning')
      });
  }

  unblock(): void {
    const appeal = this.selected();
    if (!appeal || appeal.accountStatus !== 'BLOCKED' || this.busy()) return;
    const data: ConfirmDialogData = {
      title: 'Mở khóa tài khoản này?',
      message: `${appeal.fullName || appeal.email} đăng nhập lại được ngay. Bạn vẫn nên gửi phản hồi để họ biết.`,
      confirmText: 'Mở khóa',
      cancelText: 'Hủy',
      confirmColor: 'primary'
    };
    this.dialog.open(ConfirmDialogComponent, { width: '450px', data, panelClass: 'custom-premium-dialog' })
      .afterClosed().subscribe(confirmed => {
        if (!confirmed) return;
        this.busy.set(true);
        this.users.changeStatus(appeal.userId, 'ACTIVE')
          .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.selected.set({ ...appeal, accountStatus: 'ACTIVE' });
              if (!this.reply.trim()) {
                this.setReply('Chào bạn, tài khoản của bạn đã được mở khóa. Bạn có thể đăng nhập lại ngay.');
              }
              this.flash('Đã mở khóa tài khoản. Gửi phản hồi để báo cho người dùng.', 'success');
            },
            error: (err: HttpErrorResponse) => this.flash(this.message(err, 'Chưa mở khóa được tài khoản.'), 'warning')
          });
      });
  }

  initial(appeal: AccountAppeal): string {
    return (appeal.fullName || appeal.email || '?').trim().charAt(0).toUpperCase();
  }

  excerpt(text: string): string {
    const plain = text.replace(/\s+/g, ' ').trim();
    return plain.length > 120 ? `${plain.slice(0, 119)}…` : plain;
  }

  private afterUpdate(updated: AccountAppeal): void {
    this.selected.set(updated);
    // Thư rời tab hiện tại (vd. "Chưa đọc" → đã xử lý) thì bỏ khỏi danh sách đang xem.
    const status = TAB_STATUS[this.tab()];
    if (status && updated.status !== status) {
      this.appeals.update(list => list.filter(item => item.appealId !== updated.appealId));
      this.total.update(total => Math.max(0, total - 1));
    } else {
      this.replace(updated);
    }
    this.refreshUnread();
  }

  /** Mở thư chỉ cập nhật tại chỗ (thư đang đọc không biến khỏi danh sách), như hộp thư email. */
  private replace(updated: AccountAppeal): void {
    this.appeals.update(list => list.map(item => item.appealId === updated.appealId ? { ...item, ...updated } : item));
  }

  private refreshUnread(): void {
    this.repository.unreadCount().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: count => this.unread.set(count), error: () => this.unread.set(null) });
  }

  private flash(text: string, tone: 'success' | 'warning'): void {
    this.notice.set({ text, tone });
  }

  private message(err: HttpErrorResponse, fallback: string): string {
    const message = err?.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  }
}
