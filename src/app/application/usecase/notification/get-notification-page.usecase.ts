import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationPage } from '@application/dto/notification/notification.dto';
import { PageFilter } from '@application/dto/page.filter';
import { NOTIFICATION_REPOSITORY_TOKEN, NotificationRepository } from '@application/ports/persistence/notification.repository';

/** Mot trang thong bao kem tong so, cho trang Thong bao (loc Chua doc qua filter "status : 'UNREAD'"). */
@Injectable({ providedIn: 'root' })
export class GetNotificationPageUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY_TOKEN) private repository: NotificationRepository) { }

  execute(filter: PageFilter): Observable<NotificationPage> {
    return this.repository.getNotificationPage(filter);
  }
}
