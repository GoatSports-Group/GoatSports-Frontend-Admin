import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { ChatMessage } from '@application/dto/chat/chat.dto';
import { ChatTypingEvent, SocialSocketService } from '@application/ports/social-socket.service';
import { MessageApi, toMessage } from '@infrastructure/api/chat.api';
import { environment } from '@environments/environment';

/** Khung STOMP toi gian (giong StompWebSocketService cua thong bao va ban social cua client). */
function frame(command: string, headers: Record<string, string>, body = ''): string {
  return `${command}\n${Object.entries(headers).map(([key, value]) => `${key}:${value}`).join('\n')}\n\n${body}\0`;
}

function parse(data: string): { command: string; headers: Record<string, string>; body: string } | null {
  const raw = data.replace(/\r/g, '');
  const end = raw.indexOf('\0');
  const lines = (end >= 0 ? raw.slice(0, end) : raw).split('\n');
  const command = lines[0]?.trim();
  if (!command) return null;
  const headers: Record<string, string> = {};
  let index = 1;
  for (; index < lines.length && lines[index].trim() !== ''; index++) {
    const colon = lines[index].indexOf(':');
    if (colon > 0) headers[lines[index].slice(0, colon).trim()] = lines[index].slice(colon + 1).trim();
  }
  return { command, headers, body: lines.slice(index + 1).join('\n') };
}

/**
 * WebSocket social-service cho trang Tin nhan cua admin: kenh rieng cua minh, hop thu ho tro (admin) va tung doan chat
 * dang mo. Tu ket noi lai (lui dan toi 30s); truoc khi bat tay goi /auth/me de cookie phien da duoc lam moi.
 */
@Injectable({ providedIn: 'root' })
export class SocialSocketServiceImpl implements SocialSocketService {
  private readonly http = inject(HttpClient);
  private readonly roomSubject = new Subject<ChatMessage>();
  private readonly inboxSubject = new Subject<ChatMessage>();
  private readonly supportSubject = new Subject<ChatMessage>();
  private readonly typingSubject = new Subject<ChatTypingEvent>();
  readonly roomMessages$: Observable<ChatMessage> = this.roomSubject.asObservable();
  readonly inboxMessages$: Observable<ChatMessage> = this.inboxSubject.asObservable();
  readonly supportMessages$: Observable<ChatMessage> = this.supportSubject.asObservable();
  readonly typingEvents$: Observable<ChatTypingEvent> = this.typingSubject.asObservable();

  private socket: WebSocket | null = null;
  private connected = false;
  private shouldReconnect = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private probe: Subscription | null = null;
  private options: { userId: string; listenSupport: boolean } | null = null;
  private readonly rooms = new Set<string>();

  connect(options: { userId: string; listenSupport: boolean }): void {
    this.options = options;
    this.shouldReconnect = true;
    if (this.socket || this.probe) return;
    this.probe = this.http.get(`${environment.apiUrl}/auth-service/api/v1/auth/me`, { withCredentials: true }).subscribe({
      next: () => { this.probe = null; this.open(); },
      error: () => { this.probe = null; this.scheduleReconnect(); }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.probe?.unsubscribe();
    this.probe = null;
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    socket?.close();
  }

  subscribeRoom(roomId: string): void {
    if (!roomId || this.rooms.has(roomId)) return;
    this.rooms.add(roomId);
    if (this.connected) this.subscribeRoomFrames(roomId);
  }

  unsubscribeRoom(roomId: string): void {
    if (!this.rooms.delete(roomId)) return;
    if (!this.connected) return;
    this.send(frame('UNSUBSCRIBE', { id: `room-${roomId}` }));
    this.send(frame('UNSUBSCRIBE', { id: `typing-${roomId}` }));
  }

  sendTyping(roomId: string, typing: boolean): void {
    if (!this.connected || !roomId) return;
    this.send(frame('SEND', { destination: '/app/social/chat.typing' }, JSON.stringify({ conversationId: roomId, typing })));
  }

  private subscribeRoomFrames(roomId: string): void {
    this.send(frame('SUBSCRIBE', { id: `room-${roomId}`, destination: `/topic/conversations/${roomId}` }));
    this.send(frame('SUBSCRIBE', { id: `typing-${roomId}`, destination: `/topic/conversations/${roomId}/typing` }));
  }

  private open(): void {
    const url = environment.apiUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/social-service/ws';
    try {
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.onopen = () => {
        if (this.socket === socket) this.send(frame('CONNECT', { 'accept-version': '1.1,1.2', 'heart-beat': '0,0' }));
      };
      socket.onmessage = event => {
        if (this.socket === socket && typeof event.data === 'string') this.handle(event.data);
      };
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        this.connected = false;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handle(data: string): void {
    if (data === '\n' || data === '\r\n') return;
    const message = parse(data);
    if (!message) return;
    if (message.command === 'CONNECTED') {
      this.connected = true;
      this.attempts = 0;
      if (this.options) {
        this.send(frame('SUBSCRIBE', { id: 'inbox', destination: `/topic/users/${this.options.userId}/messages` }));
        if (this.options.listenSupport) this.send(frame('SUBSCRIBE', { id: 'support', destination: '/topic/support/messages' }));
      }
      this.rooms.forEach(roomId => this.subscribeRoomFrames(roomId));
      return;
    }
    if (message.command !== 'MESSAGE') return;
    const destination = message.headers['destination'] ?? '';
    const typing = destination.match(/^\/topic\/conversations\/([^/]+)\/typing$/);
    if (typing) {
      try {
        const body = JSON.parse(message.body) as { userId?: string; typing?: boolean };
        if (body.userId) this.typingSubject.next({ roomId: typing[1], userId: body.userId, typing: !!body.typing });
      } catch {
        // bo qua khung hong
      }
      return;
    }
    let payload: MessageApi;
    try {
      payload = JSON.parse(message.body);
    } catch {
      return;
    }
    if (destination.startsWith('/topic/support')) {
      this.supportSubject.next(toMessage(payload));
    } else if (destination.startsWith('/topic/users/')) {
      this.inboxSubject.next(toMessage(payload));
    } else {
      const roomId = destination.match(/^\/topic\/conversations\/([^/]+)$/)?.[1];
      if (roomId) this.roomSubject.next(toMessage({ ...payload, conversationId: payload.conversationId || roomId }));
    }
  }

  private send(raw: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(raw);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer || !this.options) return;
    const delay = Math.min(30_000, 2000 * 2 ** this.attempts++) * (0.5 + Math.random() * 0.5);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.options) this.connect(this.options);
    }, delay);
  }
}
