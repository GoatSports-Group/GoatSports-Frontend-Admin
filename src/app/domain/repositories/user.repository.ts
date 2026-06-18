import { Observable } from 'rxjs';
import { BaseResponse } from '../entities/base';
import { User, UserListResult } from '../entities/user';

export interface UserRepository {
  getUsers(page: number, size: number, search?: string): Observable<BaseResponse<UserListResult>>;
  assignRole(userId: string, roleId: string): Observable<BaseResponse<User>>;
}
