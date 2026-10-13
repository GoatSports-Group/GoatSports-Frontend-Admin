/** Nhãn tiếng Việt của các hành động đang được ghi (@AuditLog ở các service + sự kiện thanh toán). Mã lạ hiện nguyên mã. */
export const ACTION_LABEL: Readonly<Record<string, string>> = {
  LOGIN: 'Đăng nhập', LOGOUT: 'Đăng xuất', REGISTER: 'Đăng ký tài khoản', VERIFY_OTP: 'Xác thực OTP',
  FORGOT_PASSWORD: 'Quên mật khẩu', CREATE_PASSWORD: 'Tạo mật khẩu', CHANGE_PASSWORD: 'Đổi mật khẩu',
  GET_USER: 'Xem thông tin tài khoản', UPDATE_USER: 'Cập nhật hồ sơ', UPDATE_AVATAR: 'Đổi ảnh đại diện',
  ADMIN_CREATE_USER: 'Admin tạo tài khoản', ADMIN_ASSIGN_ROLE: 'Admin gán vai trò', ASSIGN_ROLE: 'Gán vai trò',
  ADMIN_CHANGE_USER_STATUS: 'Admin khóa / mở khóa tài khoản', ADMIN_TOGGLE_VERIFY: 'Admin đổi xác thực tài khoản',
  ADMIN_RESET_PASSWORD: 'Admin đặt lại mật khẩu',
  CREATE_ROLE: 'Tạo vai trò', UPDATE_ROLE: 'Cập nhật vai trò', DELETE_ROLE: 'Xóa vai trò',
  ACTIVATE_ROLE: 'Bật vai trò', DEACTIVE_ROLE: 'Tắt vai trò',
  GET_MY_SPORT_PROFILES: 'Xem hồ sơ thể thao', CREATE_SPORT_PROFILE: 'Tạo hồ sơ thể thao',
  UPDATE_SPORT_PROFILE: 'Cập nhật hồ sơ thể thao', DELETE_SPORT_PROFILE: 'Xóa hồ sơ thể thao',
  CREATE_APPLICATION: 'Tạo hồ sơ chủ sân', SUBMIT_APPLICATION: 'Nộp hồ sơ chủ sân', CREATE_DOCUMENTS: 'Tải giấy tờ hồ sơ',
  ADMIN_SUSPEND_VENUE: 'Đình chỉ cơ sở', ADMIN_REINSTATE_VENUE: 'Gỡ đình chỉ cơ sở',
  MODERATE_REVIEW: 'Kiểm duyệt đánh giá', MODERATE_SOCIAL_CONTENT: 'Xử lý báo cáo nội dung',
  REVIEW_CONTENT_APPEAL: 'Xét khiếu nại', SEND_BROADCAST: 'Gửi thông báo hàng loạt',
  CREATE_NOTIFICATION: 'Tạo thông báo', READ_NOTIFICATION: 'Đọc thông báo', READ_NOTIFICATIONS: 'Đọc tất cả thông báo',
  DELETE_NOTIFICATION: 'Xóa thông báo',
  EXPORT_ALL_BOOKINGS: 'Xuất báo cáo đơn đặt sân', PREVIEW_ALL_BOOKINGS: 'Xem trước báo cáo đơn đặt sân',
  EXPORT_PLATFORM_FINANCE: 'Xuất báo cáo tài chính', DOWNLOAD_REPORT_EXPORT: 'Tải báo cáo đã xuất',
  EXPORT_OWN_BOOKINGS: 'Chủ sân xuất đơn đặt sân', PREVIEW_OWN_BOOKINGS: 'Chủ sân xem trước đơn đặt sân',
  EXPORT_OWN_REVENUE: 'Chủ sân xuất doanh thu', PREVIEW_OWN_REVENUE: 'Chủ sân xem trước doanh thu',
  EXPORT_OWN_PERIODIC_REPORT: 'Chủ sân xuất báo cáo định kỳ', GENERATE_OWN_PERIODIC_REPORT: 'Chủ sân tạo báo cáo định kỳ',
  EXPORT_OWNER_BOOKING_INVOICE: 'Xuất hóa đơn đặt sân', PREVIEW_OWNER_BOOKING_INVOICE: 'Xem trước hóa đơn đặt sân',
  REMIND_REFUND: 'Nhắc khoản hoàn tiền', RETRY_FAILED_REFUNDS: 'Chi lại khoản hoàn lỗi',
  GET_PRESIGNED: 'Xin link tải lên tệp', CONFIRM_FILE: 'Xác nhận tệp', MOVE_FILE: 'Chuyển tệp',
  DOWNLOAD_FILE: 'Tải tệp', DELETE_FILE: 'Xóa tệp', DELETE_FILE_BY_URL: 'Xóa tệp',
  'payment.succeeded.v1': 'Thanh toán thành công', 'payment.cancelled.v1': 'Thanh toán bị hủy',
  'payment.expired.v1': 'Thanh toán hết hạn', 'refund.processing.v1': 'Đang chi hoàn tiền',
  'refund.succeeded.v1': 'Hoàn tiền thành công', 'refund.awaiting-bank-account.v1': 'Hoàn tiền chờ tài khoản ngân hàng'
};

/** Nguồn ghi nhật ký: thao tác qua API (gateway) hoặc sự kiện do service phát ra. */
export const SOURCE_LABEL: Readonly<Record<string, string>> = {
  'api-gateway': 'Thao tác qua API',
  'payment-service': 'Sự kiện thanh toán'
};

export type LogResult = '' | 'ok' | 'error';

export interface LogQuery {
  query: string;
  action: string;
  source: string;
  result: LogResult;
  /** yyyy-MM-dd theo giờ máy. */
  fromDate: string;
  toDate: string;
}

export function actionLabel(action: string | null | undefined): string {
  if (!action) return 'Gọi API';
  return ACTION_LABEL[action] ?? ACTION_LABEL[action.toUpperCase()] ?? action;
}

/** Sự kiện không qua HTTP (statusCode 0) là "Sự kiện"; 4xx / 5xx là lỗi. */
export function resultOf(statusCode: number): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (!statusCode) return { label: 'Sự kiện', tone: 'neutral' };
  if (statusCode >= 500) return { label: `Lỗi ${statusCode}`, tone: 'danger' };
  if (statusCode >= 400) return { label: `Từ chối ${statusCode}`, tone: 'warning' };
  return { label: 'Thành công', tone: 'success' };
}

/** Bộ lọc kiểu RSQL mà audit-service hiểu (MongoCriteriaConverter). */
export function buildLogFilter(query: LogQuery): string {
  const parts: string[] = [];
  const text = query.query.trim();
  // `~` là regex của Mongo: ký tự đặc biệt đổi thành "." (một ký tự bất kỳ) để từ khóa không phá regex. Không escape
  // bằng "\" vì parser chuỗi của bộ lọc cũng dùng "\" (cho dấu ').
  if (text) parts.push(`description ~ '${quote(text.replace(/[.*+?^${}()|[\]\\]/g, '.'))}'`);
  if (query.action) parts.push(`action = '${quote(query.action)}'`);
  if (query.source) parts.push(`sourceService = '${quote(query.source)}'`);
  if (query.result === 'error') parts.push('statusCode >= 400');
  if (query.result === 'ok') parts.push('statusCode < 400');
  if (query.fromDate) parts.push(`timestamp >= '${localDayUtc(query.fromDate, 0)}'`);
  if (query.toDate) parts.push(`timestamp < '${localDayUtc(query.toDate, 1)}'`);
  return parts.join(' and ');
}

/** [00:00 hôm nay, 00:00 ngày mai) theo giờ máy, đổi sang UTC 'yyyy-MM-ddTHH:mm:ss' như timestamp đã lưu. */
export function todayUtcRange(now = new Date()): { from: string; to: string; dayStart: Date } {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: utc(dayStart), to: utc(new Date(dayStart.getTime() + 86_400_000)), dayStart };
}

/** 00:00 (giờ máy) của ngày `yyyy-MM-dd` cộng `plusDays`, ở dạng UTC như timestamp đã lưu. */
function localDayUtc(date: string, plusDays: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return utc(new Date(year, month - 1, day + plusDays));
}

function utc(date: Date): string {
  return date.toISOString().slice(0, 19);
}

function quote(value: string): string {
  return value.replace(/'/g, "\\'");
}
