import { Notification, NotificationType } from '@application/dto/notification/notification.dto';

/** Icon, tong mau (cap trang thai §3) va nhan cua tung loai thong bao; dung chung cho chuong o topbar va trang Thong bao. */
export type NotificationTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface TypeView { icon: string; tone: NotificationTone; label: string; }

// Server co the gui loai ma enum admin chua liet ke (REVIEW, MESSAGE...): tra cuu theo chuoi, loai la -> mac dinh.
const VIEWS: Record<string, TypeView> = {
  [NotificationType.OWNER_APPLICATION]: { icon: 'clipboard-check', tone: 'warning', label: 'Hồ sơ chủ sân' },
  [NotificationType.BOOKING]: { icon: 'calendar', tone: 'success', label: 'Đặt sân' },
  [NotificationType.PAYMENT]: { icon: 'credit-card', tone: 'info', label: 'Thanh toán' },
  REFUND: { icon: 'wallet-cards', tone: 'info', label: 'Hoàn tiền' },
  REVIEW: { icon: 'star', tone: 'warning', label: 'Đánh giá' },
  CHECK_IN: { icon: 'circle-check', tone: 'success', label: 'Nhận sân' },
  MESSAGE: { icon: 'message-circle', tone: 'primary', label: 'Tin nhắn' },
  TOURNAMENT: { icon: 'trophy', tone: 'primary', label: 'Giải đấu' },
  CONTENT_MODERATION: { icon: 'shield-alert', tone: 'danger', label: 'Kiểm duyệt' },
  [NotificationType.USER]: { icon: 'user', tone: 'neutral', label: 'Tài khoản' },
  [NotificationType.SYSTEM]: { icon: 'bell', tone: 'neutral', label: 'Hệ thống' }
};

const FALLBACK: TypeView = { icon: 'bell', tone: 'neutral', label: 'Thông báo' };

export function notificationView(type: string | undefined): TypeView {
  return (type && VIEWS[type]) || FALLBACK;
}

/** Trang lien quan de mo khi bam thong bao; null = chi danh dau da doc. */
export function notificationRoute(notification: Notification, isPlatformAdmin: boolean): string | null {
  switch (notification.type as string) {
    case NotificationType.OWNER_APPLICATION: return isPlatformAdmin ? '/admin/owner-applications' : '/admin/applications';
    case NotificationType.BOOKING:
    case 'CHECK_IN': return isPlatformAdmin ? '/admin/bookings' : '/admin/owner-bookings';
    case NotificationType.PAYMENT:
    case 'REFUND': return isPlatformAdmin ? '/admin/bookings' : '/admin/finance';
    case 'REVIEW': return isPlatformAdmin ? '/admin/platform-reviews' : '/admin/reviews';
    case 'TOURNAMENT': return isPlatformAdmin ? null : '/admin/tournaments';
    case 'CONTENT_MODERATION': return isPlatformAdmin ? '/admin/moderation' : null;
    case 'MESSAGE': return '/admin/messages';
    default: return null;
  }
}

/** "Vừa xong", "12 phút trước", "3 giờ trước", "Hôm qua", "23 ngày trước", rồi ngày tháng. */
export function relativeTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 30) return `${days} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
