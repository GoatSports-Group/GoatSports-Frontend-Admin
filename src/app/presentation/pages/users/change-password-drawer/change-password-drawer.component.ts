import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { User } from '@application/dto/user/user.dto';
import { UserService } from '@presentation/services/user.service';
import { PASSWORD_PATTERN } from '@shared/constants/password.constants';
import { calculatePasswordStrength } from '@shared/utils/password.utils';
import { getDisplayAvatar } from '@shared/utils/user-display.utils';

@Component({
  selector: 'app-change-password-drawer',
  templateUrl: './change-password-drawer.component.html',
  styleUrls: ['./change-password-drawer.component.scss'],
  standalone: false
})
export class ChangePasswordDrawerComponent implements OnChanges {
  readonly getDisplayAvatar = getDisplayAvatar;
  readonly getPasswordStrength = calculatePasswordStrength;
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
