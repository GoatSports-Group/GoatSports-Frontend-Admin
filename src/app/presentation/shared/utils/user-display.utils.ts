import { RoleEnum } from '@application/dto/role/role.dto';
import { GENDER_ENUM_OPTIONS, User } from '@application/dto/user/user.dto';
import { environment } from '@environments/environment';

export function getFallbackAvatar(user: User): string {
  const seed = encodeURIComponent(user.fullName || user.username);
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
}

export function getAvatarUrl(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return '';
  if (/^https?:\/\//.test(avatarUrl)) return avatarUrl;
  return `${environment.apiUrl}/storage-service/api/v1/files/download?key=${avatarUrl}`;
}

export function getDisplayAvatar(user: User | null | undefined): string {
  if (!user) return '';
  return user.avatarUrl ? getAvatarUrl(user.avatarUrl) : getFallbackAvatar(user);
}

export function getRoleLabel(role?: string): string {
  if (!role) return '';
  return RoleEnum.find(item => item.value === role)?.label || role;
}

export function getGenderLabel(gender: string): string {
  return GENDER_ENUM_OPTIONS.find(item => item.value === gender)?.label || gender;
}
