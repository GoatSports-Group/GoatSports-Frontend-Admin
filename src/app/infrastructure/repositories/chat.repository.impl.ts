import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatMessage, ChatMessageWindow, ChatRoom, ChatRoomType, SendChatMessage } from '@application/dto/chat/chat.dto';
import { ChatRepository } from '@application/ports/persistence/chat.repository';
import { ChatApi } from '@infrastructure/api/chat.api';

@Injectable({ providedIn: 'root' })
export class ChatRepositoryImpl implements ChatRepository {
  private readonly api = inject(ChatApi);

  getRooms(types: readonly ChatRoomType[], page: number, size: number): Observable<ChatRoom[]> {
    return this.api.getRooms(types, page, size);
  }

  getSupportInbox(page: number, size: number): Observable<ChatRoom[]> {
    return this.api.getSupportInbox(page, size);
  }

  openSupport(ownerId?: string): Observable<ChatRoom> {
    return this.api.openSupport(ownerId);
  }

  getRoom(roomId: string): Observable<ChatRoom> {
    return this.api.getRoom(roomId);
  }

  getMessagesByCursor(roomId: string, cursor: { before?: string; after?: string }, size: number): Observable<ChatMessage[]> {
    return this.api.getMessagesByCursor(roomId, cursor, size);
  }

  getUnreadWindow(roomId: string, size: number): Observable<ChatMessageWindow> {
    return this.api.getUnreadWindow(roomId, size);
  }

  sendMessage(roomId: string, request: SendChatMessage): Observable<ChatMessage> {
    return this.api.sendMessage(roomId, request);
  }

  markRead(roomId: string): Observable<void> {
    return this.api.markRead(roomId);
  }

  setMuted(roomId: string, muted: boolean): Observable<void> {
    return this.api.setMuted(roomId, muted);
  }

  clearRoom(roomId: string): Observable<void> {
    return this.api.clearRoom(roomId);
  }
}
