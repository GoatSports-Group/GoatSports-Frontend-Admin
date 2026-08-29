import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { WebSocketService } from '@application/ports/websocket.service';
import { environment } from "@environments/environment"

class StompFrame {
  constructor(
    public command: string,
    public headers: Record<string, string>,
    public body: string
  ) { }

  static parse(data: string): StompFrame | null {
    if (!data) return null;
    const raw = data.replace(/\r/g, '');
    const nullIdx = raw.indexOf('\0');
    const content = nullIdx !== -1 ? raw.substring(0, nullIdx) : raw;

    const lines = content.split('\n');
    const command = lines[0].trim();
    if (!command) return null;

    const headers: Record<string, string> = {};
    let lineIdx = 1;
    while (lineIdx < lines.length && lines[lineIdx].trim() !== '') {
      const line = lines[lineIdx];
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        headers[key] = value;
      }
      lineIdx++;
    }

    const body = lines.slice(lineIdx + 1).join('\n');
    return new StompFrame(command, headers, body);
  }

  toString(): string {
    let raw = this.command + '\n';
    for (const key of Object.keys(this.headers)) {
      raw += `${key}:${this.headers[key]}\n`;
    }
    raw += '\n' + this.body + '\0';
    return raw;
  }
}

@Injectable({
  providedIn: 'root'
})
export class StompWebSocketService implements WebSocketService {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimeout: any = null;
  private reconnectEnabled = false;
  private apiBase = environment.apiUrl;
  private subscriptionId = 'sub-admin-notifications';
  private destination: string | null = null;

  private notificationSubject = new Subject<Notification>();
  public notifications$: Observable<Notification> = this.notificationSubject.asObservable();

  constructor() { }

  public connect(destination: string): void {
    if (!destination) return;
    if ((this.socket || this.isConnected) && this.destination === destination) {
      return;
    }

    this.disconnect();
    this.destination = destination;
    this.subscriptionId = `sub-notifications-${this.destination.replace(/[^a-zA-Z0-9]/g, '-')}`;
    this.reconnectEnabled = true;
    this.openSocket();
  }

  private openSocket(): void {
    if (!this.reconnectEnabled || !this.destination || this.socket) return;

    let wsUrl = this.apiBase.replace(/^http/, 'ws');
    if (!wsUrl.endsWith('/')) {
      wsUrl += '/';
    }
    wsUrl += 'notification-service/ws';

    console.log('Connecting to WebSocket at:', wsUrl);

    try {
      const socket = new WebSocket(wsUrl);
      this.socket = socket;

      socket.onopen = () => {
        if (this.socket !== socket || !this.reconnectEnabled) return;
        console.log('WebSocket connection opened. Sending STOMP CONNECT...');
        this.sendConnectFrame();
      };

      socket.onmessage = (event: MessageEvent) => {
        if (this.socket !== socket) return;
        this.handleMessage(event.data);
      };

      socket.onclose = (event: CloseEvent) => {
        console.log('WebSocket connection closed:', event.reason);
        this.handleDisconnect(socket);
      };

      socket.onerror = (error: Event) => {
        console.error('WebSocket error occurred:', error);
      };
    } catch (err) {
      console.error('Error starting WebSocket connection:', err);
      this.socket = null;
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.reconnectEnabled = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      if (this.isConnected) {
        this.sendUnsubscribeFrame();
      }
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.destination = null;
  }

  private sendConnectFrame(): void {
    if (!this.socket) return;

    const connectFrame = new StompFrame('CONNECT', {
      'accept-version': '1.1,1.2',
      'heart-beat': '10000,10000'
    }, '');

    this.socket.send(connectFrame.toString());
  }

  private sendSubscribeFrame(): void {
    if (!this.socket || !this.destination) return;

    const subscribeFrame = new StompFrame('SUBSCRIBE', {
      id: this.subscriptionId,
      destination: this.destination
    }, '');

    this.socket.send(subscribeFrame.toString());
    console.log(`STOMP SUBSCRIBE sent for ${this.destination}`);
  }

  private sendUnsubscribeFrame(): void {
    if (!this.socket || !this.isConnected) return;

    const unsubscribeFrame = new StompFrame('UNSUBSCRIBE', {
      id: this.subscriptionId
    }, '');

    try {
      this.socket.send(unsubscribeFrame.toString());
      console.log('STOMP UNSUBSCRIBE sent');
    } catch (e) {
      console.error('Error sending unsubscribe frame:', e);
    }
  }

  private handleMessage(data: string): void {
    if (data === '\n' || data === '\r\n') {
      return;
    }

    try {
      const frame = StompFrame.parse(data);
      if (!frame) return;

      switch (frame.command) {
        case 'CONNECTED':
          console.log('STOMP CONNECTED successfully.');
          this.isConnected = true;
          this.sendSubscribeFrame();
          break;
        case 'MESSAGE':
          if (frame.headers['destination'] === this.destination) {
            console.log('STOMP MESSAGE received:', frame.body);
            try {
              const notification: Notification = JSON.parse(frame.body);
              this.notificationSubject.next(notification);
            } catch (jsonErr) {
              console.error('Failed to parse STOMP message body as JSON:', jsonErr);
            }
          }
          break;
        case 'ERROR':
          console.error('STOMP ERROR frame received:', frame.body);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  }

  private handleDisconnect(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.isConnected = false;
    this.socket = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectEnabled && this.destination && !this.reconnectTimeout) {
      console.log('Attempting reconnection in 5 seconds...');
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.openSocket();
      }, 5000);
    }
  }
}
