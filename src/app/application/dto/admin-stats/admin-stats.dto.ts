/** Số liệu toàn nền tảng cho dashboard admin (auth / venue / club service). */
export interface PlatformUserStats {
  fromDate: string;
  toDate: string;
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  newUsers: number;
  newByDay: Array<{ date: string; count: number }>;
}

export interface PlatformBookingStats {
  fromDate: string;
  toDate: string;
  activeVenues: number;
  activeCourts: number;
  bookings: number;
  /** Tổng giá trị đơn đã giữ chỗ và đã trả tiền (đã xác nhận, đã nhận sân, hoàn tất). */
  gmv: number;
  bookingsByStatus: Record<string, number>;
  byDay: Array<{ date: string; bookings: number; gmv: number }>;
  topVenues: Array<{ venueId: string; name: string; bookings: number; gmv: number }>;
}

export interface CommunityStats {
  activeClubs: number;
  disbandedClubs: number;
  tournaments: number;
  /** Theo trạng thái hiển thị của giải (mở / đóng đăng ký suy ra từ ngày). */
  tournamentsByStatus: Record<string, number>;
}
