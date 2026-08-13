import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { UserService } from '@presentation/services/user.service';
import { PASSWORD_PATTERN } from '@shared/constants/password.constants';

@Component({
  selector: 'app-create-user-drawer',
  templateUrl: './create-user-drawer.component.html',
  styleUrls: ['./create-user-drawer.component.scss'],
  standalone: false
})
export class CreateUserDrawerComponent {
  private userAdminService = inject(UserService);
  private snackBar = inject(NotifyService);

  @Input() isCreateDrawerOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  showPassword = false;
  isSubmitting = false;

  newUser = {
    username: '',
    fullName: '',
    email: '',
    gender: 'MALE',
    password: '',
    avatarUrl: ''
  };

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  getPasswordStrength(): number {
    const pwd = this.newUser.password || '';
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }

  submitCreateUser(): void {
    if (this.isSubmitting) return;

    if (!this.newUser.username || !this.newUser.username.trim()) {
      this.snackBar.open('Tên hiển thị không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.newUser.fullName || !this.newUser.fullName.trim()) {
      this.snackBar.open('Họ tên không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.newUser.email || !this.newUser.email.trim()) {
      this.snackBar.open('Email không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(this.newUser.email.trim())) {
      this.snackBar.open('Email không hợp lệ', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.newUser.gender) {
      this.snackBar.open('Giới tính không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.newUser.password) {
      this.snackBar.open('Mật khẩu không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!PASSWORD_PATTERN.test(this.newUser.password)) {
      this.snackBar.open('Mật khẩu phải có ít nhất 8 ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt', 'Đóng', {
        duration: 4000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    this.isSubmitting = true;

    const payload = {
      username: this.newUser.username.trim(),
      fullName: this.newUser.fullName.trim(),
      email: this.newUser.email.trim(),
      gender: this.newUser.gender,
      password: this.newUser.password
    };

    this.userAdminService.createUser(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.snackBar.open(`Tạo tài khoản ${payload.username} thành công!`, 'Đóng', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
        this.resetNewUserForm();
        this.created.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err.error?.message || err.error?.data || 'Tạo tài khoản thất bại, vui lòng thử lại!';
        this.snackBar.open(msg, 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      }
    });
  }

  resetNewUserForm(): void {
    this.newUser = {
      username: '',
      fullName: '',
      email: '',
      gender: 'MALE',
      password: '',
      avatarUrl: ''
    };
    this.showPassword = false;
  }
}
