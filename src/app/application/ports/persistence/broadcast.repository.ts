import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type BroadcastAudience = 'ALL' | 'PLAYER' | 'VENUE_OWNER';
export type BroadcastStatus = 'SENDING' | 'SENT' | 'FAILED';

export interface Broadcast {
  broadcastId: string;
  title: string;
  content: string;
  audience: BroadcastAudience;
  status: BroadcastStatus;
  sentBy: string;
  deliveredCount: number;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SendBroadcastRequest {
  title: string;
  content: string;
  audience: BroadcastAudience;
}

export interface BroadcastPage {
  items: Broadcast[];
  total: number;
}

/** Thông báo hệ thống do admin gửi (notification-service gửi theo lô ở nền). */
export interface BroadcastRepository {
  /** {@code idempotencyKey}: một khóa cho mỗi lần soạn; bấm lại / mạng chập chờn không gửi hai lần. */
  send(request: SendBroadcastRequest, idempotencyKey: string): Observable<Broadcast>;
  list(page: number, size: number): Observable<BroadcastPage>;
  /** Số tài khoản đang hoạt động sẽ nhận. */
  countAudience(audience: BroadcastAudience): Observable<number>;
}

export const BROADCAST_REPOSITORY_TOKEN = new InjectionToken<BroadcastRepository>('BROADCAST_REPOSITORY_TOKEN');
