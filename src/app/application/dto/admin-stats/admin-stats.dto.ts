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

/** Hoạt động cộng đồng (social-service): kỳ đang xem, tổng kỳ trước cùng độ dài để so. */
export interface SocialTotals {
  /** Bài gốc; bài chia sẻ đếm riêng ở `shares`. */
  posts: number;
  shares: number;
  comments: number;
  likes: number;
  saves: number;
  /** Có ít nhất một lần đăng, chia sẻ, bình luận, thích hoặc lưu. */
  activeUsers: number;
  postingUsers: number;
  playerCalls: number;
  playerCallsFilled: number;
}

export interface SocialActivityStats {
  fromDate: string;
  toDate: string;
  totals: SocialTotals;
  previous: SocialTotals;
  byDay: Array<{ date: string; posts: number; comments: number; likes: number; shares: number; activeUsers: number }>;
  /** `interactions`: thích + bình luận + chia sẻ trong kỳ trên bài của môn (kể cả bài đăng trước kỳ). */
  bySport: Array<{ sport: string; posts: number; interactions: number }>;
  trendingTags: Array<{ tag: string; posts: number; authors: number; previousPosts: number }>;
  /** Đủ 7 × 24 ô; dayOfWeek 1 = thứ Hai … 7 = Chủ nhật. */
  heatmap: Array<{ dayOfWeek: number; hour: number; count: number }>;
  topPosts: Array<{
    postId: string; authorId: string; excerpt: string; sport: string | null; publishedAt: string;
    likes: number; comments: number; shares: number;
  }>;
  topMembers: Array<{ userId: string; posts: number; comments: number; reactions: number }>;
}
