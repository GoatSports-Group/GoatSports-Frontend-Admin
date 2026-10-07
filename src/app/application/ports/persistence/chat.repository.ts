import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatMessage, ChatMessageWindow, ChatRoom, ChatRoomType, SendChatMessage } from '@application/dto/chat/chat.dto';

export interface ChatRepository {
  /** Doan chat cua minh, chi cac loai trong `types` (chu san: BUSINESS + SUPPORT). */
  getRooms(types: readonly ChatRoomType[], page: number, size: number): Observable<ChatRoom[]>;
  /** Hop thu chung cua doi quan tri: moi doan chat SUPPORT, moi nhat truoc. */
  getSupportInbox(page: number, size: number): Observable<ChatRoom[]>;
  /** Chu san: mo hop thu ho tro cua minh. Admin (`ownerId`): mo / chu dong nhan cho chu san do va tham gia doan chat. */
  openSupport(ownerId?: string): Observable<ChatRoom>;
  getRoom(roomId: string): Observable<ChatRoom>;
  /** Cuon hai chieu theo moc thoi gian (moi nhat truoc): `after` = tin moi hon, khong thi tin cu hon `before`. */
  getMessagesByCursor(roomId: string, cursor: { before?: string; after?: string }, size: number): Observable<ChatMessage[]>;
  getUnreadWindow(roomId: string, size: number): Observable<ChatMessageWindow>;
  sendMessage(roomId: string, request: SendChatMessage): Observable<ChatMessage>;
  markRead(roomId: string): Observable<void>;
  setMuted(roomId: string, muted: boolean): Observable<void>;
  /** Xoa doan chat phia minh; nguoi khac giu nguyen, tin moi lam doan chat hien lai. */
  clearRoom(roomId: string): Observable<void>;
}

export const CHAT_REPOSITORY_TOKEN = new InjectionToken<ChatRepository>('ChatRepository');
