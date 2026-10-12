import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize, timer } from 'rxjs';
import {
  BROADCAST_REPOSITORY_TOKEN, Broadcast, BroadcastAudience, BroadcastStatus
} from '@application/ports/persistence/broadcast.repository';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';

export const TITLE_MAX = 150;
export const CONTENT_MAX = 2000;
const POLL_MS = 4_000;

export const AUDIENCES: readonly { value: BroadcastAudience; label: string; hint: string; icon: string }[] = [
  { value: 'ALL', label: 'Tất cả người dùng', hint: 'Người chơi và chủ sân', icon: 'users' },
  { value: 'PLAYER', label: 'Người chơi', hint: 'Tài khoản người chơi', icon: 'user-round' },
  { value: 'VENUE_OWNER', label: 'Chủ sân', hint: 'Tài khoản chủ sân', icon: 'store' }
];

const STATUS_META: Readonly<Record<BroadcastStatus, { label: string; tone: string }>> = {
  SENDING: { label: 'Đang gửi', tone: 'info' },
  SENT: { label: 'Đã gửi', tone: 'success' },
  FAILED: { label: 'Gửi lỗi', tone: 'danger' }
};

/**
 * Thông báo hệ thống: admin soạn một lần, notification-service gửi theo lô tới từng tài khoản đang hoạt động
 * (hiện ở chuông thông báo, đến ngay nếu người nhận đang mở ứng dụng). Gửi rồi không thu hồi được nên luôn
 * xác nhận số người nhận trước. Mỗi lần soạn có một Idempotency-Key: bấm lại khi mạng chập chờn không gửi hai lần.
 */
@Component({
  selector: 'app-broadcasts',
  templateUrl: './broadcasts.component.html',
  styleUrls: ['./broadcasts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent]
})
export class BroadcastsComponent implements OnInit {
  private readonly repository = inject(BROADCAST_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);
  private countRequest?: Subscription;
  private poll?: Subscription;
  private idempotencyKey = crypto.randomUUID();

  readonly audiences = AUDIENCES;
  readonly titleMax = TITLE_MAX;
  readonly contentMax = CONTENT_MAX;
  readonly pageSize = PAGE_SIZE.rows;

  readonly audience = signal<BroadcastAudience>('ALL');
  readonly title = signal('');
  readonly content = signal('');
  readonly recipients = signal<number | null>(null);
  readonly countingRecipients = signal(false);
  readonly composing = signal(false);
  readonly confirming = signal(false);
  readonly sending = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly items = signal<Broadcast[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly valid = computed(() => {
    const title = this.title().trim().length;
    const content = this.content().trim().length;
    return title > 0 && title <= TITLE_MAX && content > 0 && content <= CONTENT_MAX;
  });
  readonly audienceLabel = computed(() => AUDIENCES.find(item => item.value === this.audience())!.label);

  ngOnInit(): void {
    this.load();
  }

  openCompose(): void {
    this.sendError.set(null);
    this.confirming.set(false);
    this.composing.set(true);
    this.countAudience();
  }

  /** Đóng không mất bản nháp: mở lại vẫn còn tiêu đề và nội dung đang soạn. */
  closeCompose(): void {
    if (this.sending()) return;
    this.composing.set(false);
    this.confirming.set(false);
  }

  setAudience(value: BroadcastAudience): void {
    this.audience.set(value);
    this.countAudience();
  }

  openConfirm(): void {
    if (!this.valid() || this.sending()) return;
    this.sendError.set(null);
    this.confirming.set(true);
    this.countAudience();
  }

  closeConfirm(): void {
    if (!this.sending()) this.confirming.set(false);
  }

  send(): void {
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    this.sendError.set(null);
    this.repository.send({ title: this.title().trim(), content: this.content().trim(), audience: this.audience() }, this.idempotencyKey)
      .pipe(finalize(() => this.sending.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: broadcast => {
          this.confirming.set(false);
          this.composing.set(false);
          this.notice.set(`Đang gửi "${broadcast.title}" tới ${this.audienceLabel().toLowerCase()}. Tiến độ cập nhật trong danh sách bên dưới.`);
          this.title.set('');
          this.content.set('');
          // Lần soạn mới = khóa mới; khóa cũ chỉ để thử lại đúng thông báo vừa bấm gửi.
          this.idempotencyKey = crypto.randomUUID();
          this.pageIndex.set(0);
          this.load();
        },
        error: err => this.sendError.set(err?.error?.message ?? 'Chưa gửi được thông báo. Bấm gửi lại sẽ không tạo bản trùng.')
      });
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load();
  }

  load(): void {
    this.error.set(null);
    this.repository.list(this.pageIndex(), this.pageSize)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.items.set(page.items);
          this.total.set(page.total);
          this.schedulePoll();
        },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được lịch sử thông báo.')
      });
  }

  status(status: BroadcastStatus): { label: string; tone: string } { return STATUS_META[status]; }

  audienceOf(value: BroadcastAudience): string { return AUDIENCES.find(item => item.value === value)?.label ?? value; }

  /** Còn thông báo đang gửi thì hỏi lại sau vài giây để thấy số người đã nhận tăng dần. */
  private schedulePoll(): void {
    this.poll?.unsubscribe();
    if (!this.items().some(item => item.status === 'SENDING')) return;
    this.poll = timer(POLL_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  private countAudience(): void {
    this.countRequest?.unsubscribe();
    this.countingRecipients.set(true);
    this.countRequest = this.repository.countAudience(this.audience())
      .pipe(finalize(() => this.countingRecipients.set(false)))
      .subscribe({ next: count => this.recipients.set(count), error: () => this.recipients.set(null) });
  }
}
