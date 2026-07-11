import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationRepository, NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { Notification } from '@domain/entities/notification';
import { PageFilter } from '@application/dto/page.filter';

@Injectable({
  providedIn: 'root'
})
export class GetNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository
  ) { }

  execute(filter: PageFilter): Observable<Notification[]> {
    return this.repository.getNotifications(filter);
  }
}
