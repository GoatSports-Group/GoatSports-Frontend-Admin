export interface AdminNavigationItem {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string;
  readonly developing?: boolean;
}

export interface AdminNavigationGroup {
  readonly label: string;
  readonly items: readonly AdminNavigationItem[];
}

export const PLATFORM_ADMIN_NAVIGATION: readonly AdminNavigationItem[] = [
  { title: 'Tổng quan', description: 'Số liệu và tình trạng toàn hệ thống', icon: 'layout-dashboard', route: '/dashboard' },
  { title: 'Đơn đặt sân', description: 'Quản lý lịch đặt sân và trạng thái thanh toán', icon: 'receipt', route: '/bookings' },
  { title: 'Chủ sân', description: 'Duyệt đơn và quản lý hồ sơ đối tác chủ sân', icon: 'land-plot', route: '/owner-applications' },
  { title: 'Người dùng', description: 'Quản lý tài khoản thành viên hệ thống', icon: 'users', route: '/users' },
  { title: 'Vai trò', description: 'Quản lý nhóm vai trò và quyền hạn', icon: 'shield', route: '/roles' },
  { title: 'Nhật ký', description: 'Theo dõi nhật ký hoạt động hệ thống', icon: 'activity', route: '/logs' }
];

export const VENUE_OWNER_NAVIGATION: readonly AdminNavigationItem[] = [
  { title: 'Tổng quan', description: 'Tiến trình hồ sơ và thông tin cơ sở', icon: 'layout-dashboard', route: '/dashboard' },
  { title: 'Đơn đăng ký', description: 'Tạo hồ sơ mới và theo dõi tiến trình xét duyệt', icon: 'clipboard-check', route: '/applications' },
  { title: 'Quản lý cơ sở', description: 'Thông tin, hình ảnh và tiện ích cơ sở', icon: 'land-plot', route: '/venues' },
  { title: 'Sân thi đấu', description: 'Quản lý từng sân con và trạng thái vận hành', icon: 'activity', route: '/courts' },
  { title: 'Lịch và bảng giá', description: 'Khung giờ, ngày nghỉ và quy tắc giá', icon: 'calendar', route: '/schedule' },
  { title: 'Đơn đặt sân', description: 'Theo dõi đơn thuộc cơ sở của bạn', icon: 'file-text', route: '/owner-bookings' },
  { title: 'Check-in khách', description: 'QR, Booking Code và khách walk-in', icon: 'shield-check', route: '/check-in' },
  { title: 'Doanh thu', description: 'Doanh thu và dữ liệu đối soát thực tế', icon: 'credit-card', route: '/finance' },
  { title: 'Đánh giá', description: 'Phản hồi thật từ booking đã hoàn tất', icon: 'star', route: '/reviews' }
];

export const PLATFORM_ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  { label: 'Quản trị nền tảng', items: PLATFORM_ADMIN_NAVIGATION }
];

export const VENUE_OWNER_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    label: 'Không gian làm việc',
    items: VENUE_OWNER_NAVIGATION.filter(item => ['/dashboard', '/applications'].includes(item.route))
  },
  {
    label: 'Vận hành',
    items: VENUE_OWNER_NAVIGATION.filter(item =>
      ['/venues', '/courts', '/schedule', '/owner-bookings', '/check-in'].includes(item.route)
    )
  },
  {
    label: 'Tài chính & chất lượng',
    items: VENUE_OWNER_NAVIGATION.filter(item => ['/finance', '/reviews'].includes(item.route))
  }
];
