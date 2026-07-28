import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { PageFilter } from '@application/dto/page.filter';

export interface NotificationRepository {
  getNotifications(filter: PageFilter): Observable<Notification[]>;
  getUnreadCount(): Observable<number>;
  markAsRead(id: string): Observable<Notification>;
  markAllRead(): Observable<void>;
  deleteNotification(id: string): Observable<void>;
}

export const NOTIFICATION_REPOSITORY_TOKEN = new InjectionToken<NotificationRepository>('NotificationRepository');
