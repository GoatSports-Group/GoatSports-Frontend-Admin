export type User = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  status: string;
  gender: string;
  authProviders: string[];
  phone?: string;
  country?: string;

  role: {
    roleId: string;
    name: string;
  }
  /** Quyền đang có hiệu lực (chỉ /auth/me trả). Trang admin hiện / mở theo quyền, không theo tên vai trò. */
  permissions?: string[];

  createdAt: string;
  updatedAt: string;
}
