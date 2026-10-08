import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Notification } from '@application/dto/notification/notification.dto';

/**
 * Thong bao vua toi qua WebSocket (khong gom thong bao nap lai tu REST). NotificationService phat vao; trang can phan
 * ung tuc thi (vd. dashboard chu san lam moi tinh trang san khi co don moi / huy) nghe o day ma khong phai phu thuoc
 * vao ca NotificationService.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeNotificationBus {
  private readonly subject = new Subject<Notification>();
  readonly events$: Observable<Notification> = this.subject.asObservable();

  publish(notification: Notification): void {
    this.subject.next(notification);
  }
}
