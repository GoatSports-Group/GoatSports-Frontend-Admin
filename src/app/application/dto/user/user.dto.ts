export { User } from '@domain/entity/user';

export interface UserListMeta {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

export interface UserListResult {
  meta: UserListMeta;
  result: import('@domain/entity/user').User[];
}
