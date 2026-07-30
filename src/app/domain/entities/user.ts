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

  createdAt: string;
  updatedAt: string;
}
