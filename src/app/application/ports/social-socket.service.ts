import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatMessage } from '@application/dto/chat/chat.dto';

/** WebSocket STOMP cua social-service cho trang Tin nhan cua admin. */
export interface SocialSocketService {
  /** Tin moi o cac doan chat dang theo doi (`subscribeRoom`). */
  roomMessages$: Observable<ChatMessage>;
  /** Tin moi gui toi minh o moi doan chat chua tat thong bao (kenh rieng /topic/users/{me}/messages). */
  inboxMessages$: Observable<ChatMessage>;
  /** Tin moi trong hop thu ho tro (chi ADMIN nghe duoc /topic/support/messages). */
  supportMessages$: Observable<ChatMessage>;
  connect(options: { userId: string; listenSupport: boolean }): void;
  disconnect(): void;
  subscribeRoom(roomId: string): void;
  unsubscribeRoom(roomId: string): void;
}

export const SOCIAL_SOCKET_TOKEN = new InjectionToken<SocialSocketService>('SocialSocketService');
