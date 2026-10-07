import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { ChatMessage, ChatMessageWindow, ChatRoom, ChatRoomType, SendChatMessage } from '@application/dto/chat/chat.dto';
import { environment } from '@environments/environment';

interface ConversationApi {
  conversationId: string;
  type: ChatRoomType;
  name?: string;
  subjectType?: ChatRoom['subjectType'];
  subjectId?: string;
  awaitingReply?: boolean;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount?: number;
  muted?: boolean;
  blockState?: ChatRoom['blockState'];
  members?: Array<{ userId: string; role?: string; leftAt?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface MessageApi {
  messageId: string;
  conversationId: string;
  senderId: string;
  clientMessageId?: string;
  content: string;
  type: string;
  status?: string;
  attachments?: ChatMessage['attachments'];
  sentAt: string;
}

interface SpringPage<T> { content: T[]; }

/** API Tin nhan cua social-service (/social-service/api/v1/social/conversations). */
@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/social-service/api/v1/social/conversations`;

  getRooms(types: readonly ChatRoomType[], page: number, size: number): Observable<ChatRoom[]> {
    const params = new HttpParams().set('page', page).set('size', size).set('types', types.join(','));
    return this.http.get<BaseResponse<SpringPage<ConversationApi>>>(this.base, { params })
      .pipe(map(response => (response.data?.content ?? []).map(toRoom)));
  }

  getSupportInbox(page: number, size: number): Observable<ChatRoom[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<BaseResponse<SpringPage<ConversationApi>>>(`${this.base}/support/inbox`, { params })
      .pipe(map(response => (response.data?.content ?? []).map(toRoom)));
  }

  openSupport(ownerId?: string): Observable<ChatRoom> {
    const params = ownerId ? new HttpParams().set('ownerId', ownerId) : undefined;
    return this.http.post<BaseResponse<ConversationApi>>(`${this.base}/support`, null, { params })
      .pipe(map(response => toRoom(response.data)));
  }

  getRoom(roomId: string): Observable<ChatRoom> {
    return this.http.get<BaseResponse<ConversationApi>>(`${this.base}/${roomId}`).pipe(map(response => toRoom(response.data)));
  }

  getMessagesByCursor(roomId: string, cursor: { before?: string; after?: string }, size: number): Observable<ChatMessage[]> {
    let params = new HttpParams().set('size', size);
    if (cursor.before) params = params.set('before', cursor.before);
    if (cursor.after) params = params.set('after', cursor.after);
    return this.http.get<BaseResponse<MessageApi[]>>(`${this.base}/${roomId}/messages/cursor`, { params })
      .pipe(map(response => (response.data ?? []).map(toMessage)));
  }

  getUnreadWindow(roomId: string, size: number): Observable<ChatMessageWindow> {
    const params = new HttpParams().set('size', size);
    return this.http.get<BaseResponse<{ messages: MessageApi[]; firstUnreadMessageId: string | null; hasOlder: boolean; hasNewer: boolean }>>(
      `${this.base}/${roomId}/messages/unread-window`, { params }
    ).pipe(map(response => ({
      messages: (response.data?.messages ?? []).map(toMessage),
      firstUnreadMessageId: response.data?.firstUnreadMessageId ?? null,
      hasOlder: !!response.data?.hasOlder,
      hasNewer: !!response.data?.hasNewer
    })));
  }

  sendMessage(roomId: string, request: SendChatMessage): Observable<ChatMessage> {
    return this.http.post<BaseResponse<MessageApi>>(`${this.base}/${roomId}/messages`, request)
      .pipe(map(response => toMessage(response.data)));
  }

  markRead(roomId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${roomId}/read`, null);
  }

  setMuted(roomId: string, muted: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/${roomId}/mute`, null, { params: new HttpParams().set('muted', muted) });
  }

  clearRoom(roomId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${roomId}`);
  }
}

function toRoom(item: ConversationApi): ChatRoom {
  return {
    roomId: item.conversationId,
    type: item.type,
    name: item.name,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    awaitingReply: !!item.awaitingReply,
    participants: (item.members ?? []).filter(member => !member.leftAt),
    lastMessage: item.lastMessageContent,
    lastMessageAt: item.lastMessageAt,
    lastSenderId: item.lastSenderId,
    unreadCount: item.unreadCount ?? 0,
    muted: !!item.muted,
    blockState: item.blockState ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export function toMessage(item: MessageApi): ChatMessage {
  return {
    messageId: item.messageId,
    roomId: item.conversationId,
    senderId: item.senderId,
    clientMessageId: item.clientMessageId,
    content: item.content ?? '',
    type: item.type,
    status: item.status,
    attachments: item.attachments ?? [],
    createdAt: item.sentAt,
    deliveryState: 'SENT'
  };
}
