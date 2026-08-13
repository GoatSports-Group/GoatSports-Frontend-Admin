import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { User } from '@application/dto/user/user.dto';
import { UserService } from '@presentation/services/user.service';
import { PASSWORD_PATTERN } from '@shared/constants/password.constants';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-change-password-drawer',
  templateUrl: './change-password-drawer.component.html',
  styleUrls: ['./change-password-drawer.component.scss'],
  standalone: false
})
export class ChangePasswordDrawerComponent implements OnChanges {
  private userAdminService = inject(UserService);
  private snackBar = inject(NotifyService);

  @Input() isPasswordDrawerOpen = false;
  @Input() passwordEditingUser: User | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;
  isSubmittingPassword = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['passwordEditingUser'] && this.passwordEditingUser) {
      this.newPassword = '';
      this.confirmPassword = '';
      this.showNewPassword = false;
      this.showConfirmPassword = false;
    }
  }

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
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.username)}`;
  }

  getPasswordStrength(pwd: string): number {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }

  submitChangePassword(): void {
    if (this.isSubmittingPassword || !this.passwordEditingUser || !this.passwordEditingUser.userId) return;

    if (!this.newPassword) {
      this.snackBar.open('Mật khẩu mới không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-error']
      });
      return;
    }

    if (!PASSWORD_PATTERN.test(this.newPassword)) {
      this.snackBar.open('Mật khẩu phải có ít nhất 8 ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt', 'Đóng', {
        duration: 4000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-error']
      });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.snackBar.open('Mật khẩu mới và xác nhận mật khẩu không khớp', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['snackbar-error']
      });
      return;
    }

    this.isSubmittingPassword = true;

    this.userAdminService.updatePasswordByAdmin(
      this.passwordEditingUser.userId,
      this.newPassword,
      this.confirmPassword
    ).subscribe({
      next: () => {
        this.isSubmittingPassword = false;
        this.snackBar.open(`Đổi mật khẩu thành công!`, 'Đóng', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });
        this.updated.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSubmittingPassword = false;
        const msg = err.error?.message || err.error?.data || 'Đổi mật khẩu thất bại, vui lòng thử lại!';
        this.snackBar.open(msg, 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }
}
