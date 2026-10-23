import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { environment } from '@environments/environment';
import { ADMIN_VENUE_REPOSITORY_TOKEN, PotentialVenue } from '@application/ports/persistence/admin-venue.repository';
import { SPORT_LABEL } from '@presentation/pages/community-analytics/community-analytics.utils';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { VenueLocation, VenueLocationModalComponent } from '../venue-location-modal/venue-location-modal.component';

/**
 * Tab "Sân tiềm năng" của Cơ sở: sân ngoài hệ thống người chơi muốn đặt online hoặc đã chơi qua ghép trận, nhiều lượt
 * muốn đặt trước, rồi nhiều kèo, rồi sân có số điện thoại. Đây là danh sách để admin liên hệ mời làm đối tác.
 *
 * "Mời" mở lời mời soạn sẵn (sửa được) kèm link trang giới thiệu `/claim/{sân}` ở client. Admin tự gửi qua Zalo hoặc
 * điện thoại: hệ thống không tự nhắn vì Nghị định 91/2020 cấm tin quảng cáo khi chưa có đồng ý, nên lời mời luôn
 * kèm câu từ chối nhận tin. Sao chép hoặc mở Zalo thì ghi lại một lần mời để biết sân nào đã liên hệ.
 */
@Component({
  selector: 'app-external-venue-potential',
  templateUrl: './external-venue-potential.component.html',
  styleUrls: ['./external-venue-potential.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent,
    VenueLocationModalComponent]
})
export class ExternalVenuePotentialComponent implements OnInit {
  private readonly repository = inject(ADMIN_VENUE_REPOSITORY_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = PAGE_SIZE.table;
  readonly pageIndex = signal(0);
  readonly items = signal<PotentialVenue[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  /** Sân đang xem trên popup bản đồ. */
  readonly locating = signal<VenueLocation | null>(null);
  /** Sân đang soạn lời mời, và nội dung lời mời (admin sửa được trước khi gửi). */
  readonly inviting = signal<PotentialVenue | null>(null);
  readonly inviteMessage = signal('');
  readonly inviteNotice = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(paging = false): void {
    this.loading.set(!paging);
    this.paging.set(paging);
    this.error.set(null);
    this.repository.getPotentialVenues(this.pageIndex(), this.pageSize).pipe(
      finalize(() => {
        this.loading.set(false);
        this.paging.set(false);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        this.items.set(page.items);
        this.total.set(page.total);
      },
      error: () => this.error.set('Chưa tải được danh sách sân tiềm năng.')
    });
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  sportsOf(item: PotentialVenue): string {
    return item.venue.sportTypes.map(sport => SPORT_LABEL[sport] ?? sport).join(' · ');
  }

  claimUrl(item: PotentialVenue): string {
    return `${environment.clientApiUrl}/claim/${item.venue.externalVenueId}`;
  }

  /** Số điện thoại chỉ còn chữ số, cho link Zalo `zalo.me/{số}`. */
  zaloUrl(item: PotentialVenue): string | null {
    const digits = (item.venue.phone ?? '').replace(/\D/g, '');
    return digits.length >= 9 ? `https://zalo.me/${digits}` : null;
  }

  openInvite(item: PotentialVenue): void {
    this.inviteNotice.set(null);
    this.inviteMessage.set(this.composeInvite(item));
    this.inviting.set(item);
  }

  closeInvite(): void {
    this.inviting.set(null);
  }

  /** Sao chép lời mời để dán vào Zalo / tin nhắn; ghi lại một lần mời. */
  async copyInvite(): Promise<void> {
    const item = this.inviting();
    if (!item) return;
    const copied = await copyText(this.inviteMessage());
    this.inviteNotice.set(copied ? 'Đã sao chép lời mời. Dán vào Zalo hoặc tin nhắn để gửi cho sân.'
      : 'Trình duyệt chặn sao chép, hãy chọn nội dung rồi sao chép thủ công.');
    if (copied) this.recordInvite(item);
  }

  /** Mở Zalo với số của sân; Zalo không nhận sẵn nội dung nên sao chép lời mời trước để dán. */
  async openZalo(): Promise<void> {
    const item = this.inviting();
    const url = item && this.zaloUrl(item);
    if (!item || !url) return;
    await copyText(this.inviteMessage());
    window.open(url, '_blank', 'noopener');
    this.inviteNotice.set('Đã sao chép lời mời và mở Zalo của sân, dán nội dung vào khung chat để gửi.');
    this.recordInvite(item);
  }

  showOnMap(item: PotentialVenue): void {
    const { name, address, latitude, longitude } = item.venue;
    this.locating.set({ name, address: address ?? item.region, latitude, longitude });
  }

  private recordInvite(item: PotentialVenue): void {
    this.repository.recordExternalVenueInvite(item.venue.externalVenueId).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: record => this.items.update(items => items.map(row => row.venue.externalVenueId === item.venue.externalVenueId
          ? { ...row, inviteCount: record.inviteCount, lastInvitedAt: record.lastInvitedAt } : row)),
        error: () => undefined
      });
  }

  private composeInvite(item: PotentialVenue): string {
    const demand = [
      item.wantCount ? `${item.wantCount} người chơi muốn đặt sân online` : '',
      item.matchCount ? `${item.matchCount} trận đã được hẹn chơi tại sân` : ''
    ].filter(Boolean).join(' và ');
    return [
      'Chào anh/chị, em liên hệ từ GOAT Sports, ứng dụng tìm sân và ghép trận thể thao.',
      `Trên GOAT Sports đang có ${demand} ${item.venue.name}.`,
      'Anh/chị có thể nhận quản lý sân miễn phí để nhận đặt sân, thu cọc online và quản lý lịch sân tại:',
      this.claimUrl(item),
      'Nếu anh/chị không muốn nhận thêm tin nhắn, chỉ cần trả lời "Không", bên em sẽ không liên hệ nữa. Cảm ơn anh/chị!'
    ].join('\n');
  }
}

/** Clipboard API cần HTTPS / localhost; ngoài đó dùng cách cũ qua textarea tạm. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  }
}
