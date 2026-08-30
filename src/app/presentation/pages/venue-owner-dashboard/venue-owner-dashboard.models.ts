export type OwnerFeatureStatus = 'AVAILABLE' | 'DEVELOPING';

export interface OwnerWorkspaceFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  status: OwnerFeatureStatus;
  plannedCapabilities: readonly string[];
}

export const OWNER_WORKSPACE_FEATURES: readonly OwnerWorkspaceFeature[] = [
  {
    id: 'application',
    title: 'Hồ sơ đối tác',
    description: 'Theo dõi tiến trình tiếp nhận, xem xét và kết quả đăng ký chủ sân.',
    icon: 'clipboard-check',
    route: '/admin/applications',
    status: 'AVAILABLE',
    plannedCapabilities: ['Tiến trình Camunda', 'Lý do từ chối', 'Lịch sử cập nhật']
  },
  {
    id: 'venues',
    title: 'Quản lý cơ sở',
    description: 'Thông tin vận hành, hình ảnh, tiện ích và trạng thái cụm sân.',
    icon: 'land-plot',
    route: '/admin/venues',
    status: 'AVAILABLE',
    plannedCapabilities: ['Chỉnh sửa cơ sở', 'Hình ảnh và tiện ích', 'Giờ hoạt động']
  },
  {
    id: 'courts',
    title: 'Sân thi đấu',
    description: 'Quản lý từng sân con, môn thể thao, mặt sân và sức chứa.',
    icon: 'activity',
    route: '/admin/courts',
    status: 'AVAILABLE',
    plannedCapabilities: ['Danh sách sân con', 'Trạng thái hoạt động', 'Bảo trì sân']
  },
  {
    id: 'schedule',
    title: 'Lịch và bảng giá',
    description: 'Thiết lập khung giờ, giá theo ngày và khả năng nhận đặt sân.',
    icon: 'calendar',
    route: '/admin/schedule',
    status: 'AVAILABLE',
    plannedCapabilities: ['Khung giờ', 'Quy tắc giá', 'Bảo trì slot']
  },
  {
    id: 'bookings',
    title: 'Đơn đặt sân',
    description: 'Theo dõi đơn thuộc cơ sở của bạn và trạng thái thanh toán thực tế.',
    icon: 'file-text',
    route: '/admin/owner-bookings',
    status: 'AVAILABLE',
    plannedCapabilities: ['Danh sách và bộ lọc', 'Chi tiết và timeline', 'Trạng thái payment thật']
  },
  {
    id: 'check-in',
    title: 'Check-in khách',
    description: 'Xác nhận khách đến sân bằng mã đặt chỗ hoặc QR hợp lệ.',
    icon: 'shield-check',
    route: '/admin/check-in',
    status: 'AVAILABLE',
    plannedCapabilities: ['Quét QR có chữ ký', 'Booking Code và walk-in', 'Lịch sử check-in']
  },
  {
    id: 'finance',
    title: 'Doanh thu và đối soát',
    description: 'Báo cáo dòng tiền chỉ từ giao dịch được provider xác nhận.',
    icon: 'credit-card',
    route: '/admin/finance',
    status: 'DEVELOPING',
    plannedCapabilities: ['Doanh thu', 'Đối soát', 'Hoàn tiền']
  },
  {
    id: 'reviews',
    title: 'Đánh giá cơ sở',
    description: 'Theo dõi phản hồi của người chơi và chất lượng từng sân.',
    icon: 'star',
    route: '/admin/reviews',
    status: 'DEVELOPING',
    plannedCapabilities: ['Điểm đánh giá', 'Phản hồi khách hàng', 'Thống kê chất lượng']
  }
];

export function findOwnerWorkspaceFeature(id: string | undefined): OwnerWorkspaceFeature | undefined {
  return OWNER_WORKSPACE_FEATURES.find(feature => feature.id === id);
}
