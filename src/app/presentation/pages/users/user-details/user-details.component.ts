import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RoleEnum } from '@application/dto/role/role.dto';
import { GENDER_ENUM_OPTIONS, User } from '@application/dto/user/user.dto';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
  standalone: false
})
export class UserDetailsComponent {
  @Input() selectedUser!: User;
  @Input() loadingDetails = false;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<User>();
  @Output() assignRole = new EventEmitter<User>();
  @Output() changePassword = new EventEmitter<User>();
  @Output() toggleVerification = new EventEmitter<{ user: User; verified: boolean }>();

  getAvatarUrl(avatarUrl: string | null | undefined): string {
    if (!avatarUrl) return '';
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    return `${environment.apiUrl}/storage-service/api/v1/files/download?key=${avatarUrl}`;
  }

  getDisplayAvatar(user: User | null | undefined): string {
    if (!user) return '';
    if (user.avatarUrl) {
      return this.getAvatarUrl(user.avatarUrl);
    }
    return this.getFallbackAvatar(user);
  }

  getFallbackAvatar(user: User): string {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.username)}`;
  }

  getFallbackRole(role?: string): string {
    if (!role) return '';
    return RoleEnum.find(r => r.value === role)?.label || role;
  }

  getFallbackGender(gender: string): string {
    return GENDER_ENUM_OPTIONS.find(g => g.value === gender)?.label || gender;
  }
}
