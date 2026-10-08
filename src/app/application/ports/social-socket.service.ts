import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatMessage } from '@application/dto/chat/chat.dto';

export interface ChatTypingEvent { roomId: string; userId: string; typing: boolean; }

/** WebSocket STOMP cua social-service cho trang Tin nhan cua admin. */
export interface SocialSocketService {
  /** Tin moi o cac doan chat dang theo doi (`subscribeRoom`). */
  roomMessages$: Observable<ChatMessage>;
  /** Tin moi gui toi minh o moi doan chat chua tat thong bao (kenh rieng /topic/users/{me}/messages). */
  inboxMessages$: Observable<ChatMessage>;
  /** Tin moi trong hop thu ho tro (chi ADMIN nghe duoc /topic/support/messages). */
  supportMessages$: Observable<ChatMessage>;
  /** Ai dang nhap o cac doan chat dang theo doi (/topic/conversations/{id}/typing). */
  typingEvents$: Observable<ChatTypingEvent>;
  connect(options: { userId: string; listenSupport: boolean }): void;
  disconnect(): void;
  subscribeRoom(roomId: string): void;
  unsubscribeRoom(roomId: string): void;
  /** Bao minh dang nhap / da ngung nhap o mot doan chat. */
  sendTyping(roomId: string, typing: boolean): void;
}

export const SOCIAL_SOCKET_TOKEN = new InjectionToken<SocialSocketService>('SocialSocketService');
