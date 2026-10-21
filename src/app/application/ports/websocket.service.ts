import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';

export interface WebSocketService {
  notifications$: Observable<Notification>;
  /** Phiên vừa bị thu hồi ở máy chủ (chủ sân bị khóa / yêu cầu xóa tài khoản): mã lý do. */
  sessionRevoked$: Observable<string>;
  /** {@code sessionDestination}: topic phiên riêng của người dùng, nghe kèm topic thông báo. */
  connect(destination: string, sessionDestination?: string): void;
  disconnect(): void;
}

export const WEBSOCKET_SERVICE_TOKEN = new InjectionToken<WebSocketService>('WebSocketService');
