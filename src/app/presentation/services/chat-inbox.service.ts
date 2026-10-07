import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, merge } from 'rxjs';
import { ChatRoom } from '@application/dto/chat/chat.dto';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { SOCIAL_SOCKET_TOKEN } from '@application/ports/social-socket.service';
import { AuthService } from '@presentation/services/auth.service';

/** Loai doan chat chu san thay trong admin: khach hoi (BUSINESS) va hop thu ho tro (SUPPORT). */
export const OWNER_ROOM_TYPES = ['BUSINESS', 'SUPPORT'] as const;
/** So doan chat dem cho huy hieu; du cho hop thu cong viec cua mot co so. */
const BADGE_WINDOW = 50;

/**
 * So tren muc "Tin nhan" o sidebar va ket noi WebSocket social cho ca shell admin.
 * Chu san: tong tin chua doc cua chat cong viec + ho tro. Admin: so doan chat ho tro dang cho tra loi.
 */
@Injectable({ providedIn: 'root' })
export class ChatInboxService {
  private readonly repository = inject(CHAT_REPOSITORY_TOKEN);
  private readonly socket = inject(SOCIAL_SOCKET_TOKEN);
  private readonly auth = inject(AuthService);
  private readonly refresh$ = new Subject<void>();
  private started = false;

  /** So hien tren sidebar (0 = an). */
  readonly badge = signal(0);

  start(destroyRef: DestroyRef): void {
    if (this.started) return;
    this.started = true;
    this.auth.currentUser$.pipe(takeUntilDestroyed(destroyRef)).subscribe(user => {
      if (!user) {
        this.socket.disconnect();
        this.badge.set(0);
        return;
      }
      this.socket.connect({ userId: user.userId, listenSupport: this.isAdmin() });
      this.refresh();
    });
    merge(this.refresh$, this.socket.inboxMessages$, this.socket.supportMessages$)
      .pipe(debounceTime(400), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.load());
  }

  /** Trang Tin nhan goi sau khi doc / gui de huy hieu khop ngay. */
  refresh(): void {
    this.refresh$.next();
  }

  isAdmin(): boolean {
    return this.auth.currentUser?.role?.name?.toUpperCase() === 'ADMIN';
  }

  private load(): void {
    const rooms$ = this.isAdmin()
      ? this.repository.getSupportInbox(0, BADGE_WINDOW)
      : this.repository.getRooms(OWNER_ROOM_TYPES, 0, BADGE_WINDOW);
    rooms$.subscribe({
      next: rooms => this.badge.set(this.isAdmin() ? countAwaiting(rooms) : countUnread(rooms)),
      error: () => undefined
    });
  }
}

function countUnread(rooms: readonly ChatRoom[]): number {
  return rooms.reduce((total, room) => total + (room.muted ? 0 : room.unreadCount), 0);
}

function countAwaiting(rooms: readonly ChatRoom[]): number {
  return rooms.filter(room => room.awaitingReply).length;
}
