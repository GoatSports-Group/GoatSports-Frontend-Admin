import { Notification } from '@domain/entities/notification';

export { Notification } from '@domain/entities/notification';

/** Mot trang thong bao kem tong so (trang Thong bao can tong de phan trang). */
/** Thông báo sau một mốc, cũ nhất trước; `hasMore` thì gọi tiếp với mốc là phần tử cuối. */
export interface NotificationCatchUpPage {
  items: Notification[];
  hasMore: boolean;
}

export interface NotificationPage {
  items: Notification[];
  total: number;
}
export { NotificationStatus, NOTIFICATION_STATUS_OPTIONS } from '@domain/enums/notification-status.enum';
export { NotificationType, NOTIFICATION_TYPE_OPTIONS } from '@domain/enums/notification-type.enum';