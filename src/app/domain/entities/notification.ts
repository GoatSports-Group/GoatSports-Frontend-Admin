import { NotificationStatus } from "@domain/enums/notification-status.enum";
import { NotificationType } from "@domain/enums/notification-type.enum";

export interface Notification {
  notificationId: string;
  receiverId: string;
  title: string;
  content: string;
  type: NotificationType;
  status: NotificationStatus;
  /** Loại của referenceId (vd REPORT_EXPORT, FINANCE_REPORT_EXPORT): chọn trang mở khi bấm. */
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  readAt?: string;
}
