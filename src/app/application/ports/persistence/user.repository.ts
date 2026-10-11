import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserRequest, User } from '@application/dto/user/user.dto';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

/** Tên hiển thị cho các trang chỉ có mã người dùng (tài chính, CLB, giải đấu). */
export interface UserSummary {
  userId: string;
  fullName: string;
  email: string;
}

export interface UserRepository {
  createUser(request: CreateUserRequest): Observable<User>;
  getUsers(filter: PageFilter): Observable<BaseListResponse<User>>;
  assignRole(userId: string, roleId: string): Observable<User>;
  exportUsersReport(format: string): Observable<Blob>;
  exportUserDetailReport(userId: string, format: string): Observable<Blob>;
  getUserById(userId: string): Observable<User>;
  updateUser(userId: string, data: Partial<User>): Observable<User>;
  updateAvatar(userId: string, tempKey: string): Observable<void>;
  updatePasswordByAdmin(userId: string, data: any): Observable<void>;
  verifyUser(userId: string, verified: boolean): Observable<void>;
  /** Khóa (BLOCKED) hoặc mở khóa (ACTIVE); khóa thì thu hồi phiên đăng nhập của người đó. */
  changeStatus(userId: string, status: 'ACTIVE' | 'BLOCKED'): Observable<void>;
  /** Tối đa 100 mã mỗi lần; mã không tồn tại bị bỏ qua. */
  getSummaries(userIds: string[]): Observable<UserSummary[]>;
}

export const USER_REPOSITORY_TOKEN = new InjectionToken<UserRepository>('UserRepository');