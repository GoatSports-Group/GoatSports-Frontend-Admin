import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { PageFilter } from '@application/dto/page.filter';
import { NotificationPage } from '@application/dto/notification/notification.dto';

export interface NotificationRepository {
  getNotifications(filter: PageFilter): Observable<Notification[]>;
  /** Nhu getNotifications nhung giu tong so tu server (meta.total). */
  getNotificationPage(filter: PageFilter): Observable<NotificationPage>;
  getUnreadCount(): Observable<number>;
  markAsRead(id: string): Observable<Notification>;
  markAllRead(): Observable<void>;
  deleteNotification(id: string): Observable<void>;
}

export const NOTIFICATION_REPOSITORY_TOKEN = new InjectionToken<NotificationRepository>('NotificationRepository');
