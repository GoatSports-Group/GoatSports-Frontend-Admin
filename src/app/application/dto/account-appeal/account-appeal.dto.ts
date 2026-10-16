/** Thư khiếu nại của tài khoản bị khóa (auth-service /admin/account-appeals). */
export type AccountAppealStatus = 'NEW' | 'READ' | 'RESOLVED';

export interface AccountAppeal {
  appealId: string;
  userId: string;
  email: string;
  fullName: string | null;
  subject: string;
  message: string;
  status: AccountAppealStatus;
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
  reply: string | null;
  repliedAt: string | null;
  /** Mã người dùng của quản trị viên đã trả lời. */
  repliedBy: string | null;
  /** Chỉ có khi mở một thư: trạng thái hiện tại của tài khoản (còn bị khóa không). */
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'BLOCKED' | null;
}

export interface AccountAppealPage {
  items: AccountAppeal[];
  total: number;
  page: number;
  pages: number;
}
