export interface AdminNavigationItem {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string;
  readonly developing?: boolean;
  /** Hien so tu ChatInboxService (muc Tin nhan). */
  readonly badge?: 'messages';
  /** Trang nen tang: quyen can co de thay va mo trang (vai tro tu tao). Khong co = moi tai khoan back-office. */
  readonly permission?: string;
  /** Chi ADMIN (backend kiem ten vai tro, vd hop thu ho tro). */
  readonly adminOnly?: boolean;
}

export interface AdminNavigationGroup {
  readonly label: string;
  readonly items: readonly AdminNavigationItem[];
}

export const PLATFORM_ADMIN_NAVIGATION: readonly AdminNavigationItem[] = [
  { title: 'Tổng quan', description: 'Số liệu và tình trạng toàn hệ thống', icon: 'layout-dashboard', route: '/dashboard', permission: 'GET_PLATFORM_STATS' },
  { title: 'Đơn đặt sân', description: 'Quản lý lịch đặt sân và trạng thái thanh toán', icon: 'receipt', route: '/bookings', permission: 'GET_ALL_BOOKINGS' },
  { title: 'Cơ sở', description: 'Mọi cơ sở trên nền tảng, đình chỉ cơ sở vi phạm', icon: 'store', route: '/platform-venues', permission: 'GET_ALL_VENUES' },
  { title: 'Chủ sân', description: 'Duyệt đơn và quản lý hồ sơ đối tác chủ sân', icon: 'land-plot', route: '/owner-applications', permission: 'GET_OWNER_APPLICATIONS' },
  { title: 'Đánh giá', description: 'Ẩn hoặc gỡ đánh giá cơ sở vi phạm', icon: 'star', route: '/platform-reviews', permission: 'GET_ALL_REVIEWS' },
  { title: 'Tài chính', description: 'Tiền thu, hoàn tiền và chi trả cho chủ sân', icon: 'banknote', route: '/platform-finance', permission: 'GET_PLATFORM_FINANCE' },
  { title: 'Hoạt động', description: 'Bài viết, tương tác, người dùng tích cực, môn và chủ đề nổi bật', icon: 'chart-line', route: '/community-analytics', permission: 'GET_PLATFORM_STATS' },
  { title: 'CLB & giải đấu', description: 'Mọi câu lạc bộ và giải đấu trên nền tảng', icon: 'trophy', route: '/platform-community', permission: 'GET_ALL_CLUBS' },
  { title: 'Gửi thông báo', description: 'Thông báo hệ thống tới người chơi và chủ sân', icon: 'megaphone', route: '/broadcasts', permission: 'GET_BROADCASTS' },
  { title: 'Người dùng', description: 'Quản lý tài khoản thành viên hệ thống', icon: 'users', route: '/users', permission: 'GET_USERS' },
  { title: 'Vai trò', description: 'Quản lý nhóm vai trò và quyền hạn', icon: 'shield', route: '/roles', permission: 'GET_ROLES' },
  { title: 'Kiểm duyệt', description: 'Xử lý báo cáo nội dung và khiếu nại của tác giả', icon: 'shield-alert', route: '/moderation', permission: 'MODERATE_SOCIAL_CONTENT' },
  { title: 'Tin nhắn', description: 'Hộp thư hỗ trợ: trả lời và chủ động nhắn cho chủ sân', icon: 'message-circle', route: '/messages', badge: 'messages', adminOnly: true },
  { title: 'Thông báo', description: 'Mọi thông báo của bạn', icon: 'bell', route: '/notifications' },
  { title: 'Nhật ký', description: 'Theo dõi nhật ký hoạt động hệ thống', icon: 'activity', route: '/logs', permission: 'GET_LOGS' },
  { title: 'Giám sát', description: 'Trạng thái microservice và tính năng AI', icon: 'server', route: '/system', permission: 'GET_SYSTEM_HEALTH' },
  { title: 'Trợ lý AI', description: 'Câu hỏi trợ lý chưa trả lời được và kiến thức bổ sung', icon: 'bot', route: '/assistant-knowledge', adminOnly: true }
];

export const VENUE_OWNER_NAVIGATION: readonly AdminNavigationItem[] = [
  { title: 'Tổng quan', description: 'Tiến trình hồ sơ và thông tin cơ sở', icon: 'layout-dashboard', route: '/dashboard' },
  { title: 'Tin nhắn', description: 'Khách hỏi về sân, giải, vé và hộp thư hỗ trợ GOAT Sports', icon: 'message-circle', route: '/messages', badge: 'messages' },
  { title: 'Đơn đăng ký', description: 'Tạo hồ sơ mới và theo dõi tiến trình xét duyệt', icon: 'clipboard-check', route: '/applications' },
  { title: 'Quản lý cơ sở', description: 'Thông tin, hình ảnh và tiện ích cơ sở', icon: 'land-plot', route: '/venues' },
  { title: 'Sân thi đấu', description: 'Quản lý từng sân con và trạng thái vận hành', icon: 'activity', route: '/courts' },
  { title: 'Lịch và bảng giá', description: 'Khung giờ, ngày nghỉ và quy tắc giá', icon: 'calendar', route: '/schedule' },
  { title: 'Đơn đặt sân', description: 'Theo dõi đơn thuộc cơ sở của bạn', icon: 'file-text', route: '/owner-bookings' },
  { title: 'Check-in khách', description: 'QR, Booking Code và khách walk-in', icon: 'shield-check', route: '/check-in' },
  { title: 'Giải đấu', description: 'Tổ chức giải tại cơ sở: sân, đăng ký, lịch và kết quả', icon: 'trophy', route: '/tournaments' },
  { title: 'Doanh thu', description: 'Doanh thu và dữ liệu đối soát thực tế', icon: 'credit-card', route: '/finance' },
  { title: 'Tài khoản', description: 'Liên kết ngân hàng để nhận doanh thu từ hệ thống', icon: 'wallet-cards', route: '/bank-account' },
  { title: 'Đánh giá', description: 'Phản hồi thật từ booking đã hoàn tất', icon: 'star', route: '/reviews' },
  { title: 'Thông báo', description: 'Mọi thông báo của bạn', icon: 'bell', route: '/notifications' }
];

const platformItems = (routes: readonly string[]) => PLATFORM_ADMIN_NAVIGATION.filter(item => routes.includes(item.route));

export const PLATFORM_ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  { label: 'Tổng quan', items: platformItems(['/dashboard']) },
  { label: 'Sân và đặt sân', items: platformItems(['/bookings', '/platform-venues', '/owner-applications', '/platform-reviews']) },
  { label: 'Tài chính', items: platformItems(['/platform-finance']) },
  { label: 'Cộng đồng', items: platformItems(['/community-analytics', '/platform-community', '/moderation', '/messages', '/broadcasts']) },
  { label: 'Hệ thống', items: platformItems(['/users', '/roles', '/logs', '/system', '/assistant-knowledge']) }
];

export const VENUE_OWNER_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    label: 'Không gian làm việc',
    items: VENUE_OWNER_NAVIGATION.filter(item => ['/dashboard', '/messages', '/applications'].includes(item.route))
  },
  {
    label: 'Vận hành',
    items: VENUE_OWNER_NAVIGATION.filter(item =>
      ['/venues', '/courts', '/schedule', '/owner-bookings', '/check-in', '/tournaments'].includes(item.route)
    )
  },
  {
    label: 'Tài chính & chất lượng',
    items: VENUE_OWNER_NAVIGATION.filter(item => ['/finance', '/bank-account', '/reviews'].includes(item.route))
  }
];

/** Vai trò làm việc ở trang quản trị nền tảng: ADMIN và mọi vai trò admin tự tạo (không phải người chơi, không phải chủ sân). */
export function isBackOfficeRole(roleName: string | null | undefined): boolean {
  const role = (roleName ?? '').toUpperCase();
  return !!role && role !== 'PLAYER' && role !== 'VENUE_OWNER';
}

/** ADMIN mở mọi trang; vai trò tự tạo mở trang có quyền tương ứng (backend vẫn kiểm từng API). */
export function canOpenPlatformItem(
  item: AdminNavigationItem, roleName: string | null | undefined, permissions: readonly string[] | null | undefined
): boolean {
  if ((roleName ?? '').toUpperCase() === 'ADMIN') return true;
  if (!isBackOfficeRole(roleName) || item.adminOnly) return false;
  return !item.permission || (permissions ?? []).includes(item.permission);
}

export function platformNavigationItem(route: string): AdminNavigationItem | undefined {
  return PLATFORM_ADMIN_NAVIGATION.find(item => item.route === route);
}
