import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationRepository } from '@application/ports/persistence/notification.repository';
import { Notification } from '@domain/entities/notification';
import { NotificationApi } from '@infrastructure/api/notification.api';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class NotificationRepositoryImpl implements NotificationRepository {
  private notificationApi = inject(NotificationApi);

  getNotifications(filter: PageFilter): Observable<Notification[]> {
    return this.notificationApi.getNotifications(filter).pipe(
      map(response => response.data?.result || [])
    );
  }

  getUnreadCount(): Observable<number> {
    return this.notificationApi.getUnreadCount().pipe(
      map(response => response.data ?? 0)
    );
  }

  markAsRead(id: string): Observable<Notification> {
    return this.notificationApi.markAsRead(id).pipe(
      map(response => response.data)
    );
  }
}
