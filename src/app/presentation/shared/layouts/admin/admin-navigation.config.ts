export interface AdminNavigationItem {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string;
  readonly developing?: boolean;
  /** Hien so tu ChatInboxService (muc Tin nhan). */
  readonly badge?: 'messages';
}

export interface AdminNavigationGroup {
  readonly label: string;
  readonly items: readonly AdminNavigationItem[];
}

export const PLATFORM_ADMIN_NAVIGATION: readonly AdminNavigationItem[] = [
  { title: 'Tổng quan', description: 'Số liệu và tình trạng toàn hệ thống', icon: 'layout-dashboard', route: '/dashboard' },
  { title: 'Đơn đặt sân', description: 'Quản lý lịch đặt sân và trạng thái thanh toán', icon: 'receipt', route: '/bookings' },
  { title: 'Cơ sở', description: 'Mọi cơ sở trên nền tảng, đình chỉ cơ sở vi phạm', icon: 'store', route: '/platform-venues' },
  { title: 'Chủ sân', description: 'Duyệt đơn và quản lý hồ sơ đối tác chủ sân', icon: 'land-plot', route: '/owner-applications' },
  { title: 'Đánh giá', description: 'Ẩn hoặc gỡ đánh giá cơ sở vi phạm', icon: 'star', route: '/platform-reviews' },
  { title: 'Người dùng', description: 'Quản lý tài khoản thành viên hệ thống', icon: 'users', route: '/users' },
  { title: 'Vai trò', description: 'Quản lý nhóm vai trò và quyền hạn', icon: 'shield', route: '/roles' },
  { title: 'Kiểm duyệt', description: 'Xử lý báo cáo nội dung và khiếu nại của tác giả', icon: 'shield-alert', route: '/moderation' },
  { title: 'Tin nhắn', description: 'Hộp thư hỗ trợ: trả lời và chủ động nhắn cho chủ sân', icon: 'message-circle', route: '/messages', badge: 'messages' },
  { title: 'Thông báo', description: 'Mọi thông báo của bạn', icon: 'bell', route: '/notifications' },
  { title: 'Nhật ký', description: 'Theo dõi nhật ký hoạt động hệ thống', icon: 'activity', route: '/logs' }
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
  { label: 'Cộng đồng', items: platformItems(['/moderation', '/messages']) },
  { label: 'Hệ thống', items: platformItems(['/users', '/roles', '/logs']) }
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
