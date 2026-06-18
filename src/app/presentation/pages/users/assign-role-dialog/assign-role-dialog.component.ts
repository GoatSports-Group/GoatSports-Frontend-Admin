import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { User } from '../../../../domain/entities/user';
import { Role } from '../../../../domain/entities/role';
import { UserService } from '../../../services/user.service';
import { RoleService } from '../../../services/role.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

export interface AssignRoleDialogData {
  user: User;
}

@Component({
  selector: 'app-assign-role-dialog',
  templateUrl: './assign-role-dialog.component.html',
  styles: [`
    .dialog-container {
      padding: 16px 20px;
      background-color: #ffffff !important;
      color: #010000 !important;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .dialog-title {
      font-weight: 800;
      font-size: 22px;
      color: #E73725 !important;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .close-btn {
      color: #718096 !important;
    }
    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #010000 !important;
    }
    .user-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background-color: #f7fafc;
      border-radius: 8px;
      border: 1px solid #E1E1E1;
    }
    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid #E1E1E1;
    }
    .user-details {
      display: flex;
      flex-direction: column;
    }
    .user-name {
      font-weight: 600;
      font-size: 13.5px;
      color: #010000 !important;
    }
    .user-email {
      font-size: 11px;
      color: #718096 !important;
    }
    .role-select-field {
      width: 100%;
      margin-top: 8px;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 28px;
      border-top: 1px solid #E1E1E1;
      padding-top: 16px;
    }
    .loading-spinner-box {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px 0;
    }
    ::ng-deep .mat-mdc-form-field {
      width: 100%;
      .mdc-text-field {
        background-color: #f7fafc !important;
        border-radius: 6px !important;
      }
      .mdc-text-field--outlined {
        background-color: transparent !important;
      }
      .mat-mdc-input-element {
        color: #010000 !important;
      }
      .mdc-floating-label, .mat-mdc-floating-label {
        color: #718096 !important;
      }
      .mdc-notched-outline__leading,
      .mdc-notched-outline__notch,
      .mdc-notched-outline__trailing {
        border-color: #E1E1E1 !important;
      }
      &.mat-focused {
        .mdc-notched-outline__leading,
        .mdc-notched-outline__notch,
        .mdc-notched-outline__trailing {
          border-color: #E73725 !important;
        }
        .mdc-floating-label, .mat-mdc-floating-label {
          color: #E73725 !important;
        }
      }
    }
    ::ng-deep .mat-mdc-select-value {
      color: #010000 !important;
      font-weight: 500;
    }
    ::ng-deep .mat-mdc-select-arrow {
      color: #718096 !important;
    }
    .dialog-actions button[mat-button] {
      color: #4a5568 !important;
      font-weight: 600;
    }
    .dialog-actions button[mat-flat-button] {
      background-color: #E73725 !important;
      color: #ffffff !important;
      font-weight: 700;
      box-shadow: 0 4px 10px rgba(231, 55, 37, 0.2);
    }
    @media (prefers-color-scheme: dark) {
      .dialog-container {
        background-color: #121212 !important;
        color: #ffffff !important;
      }
      .dialog-body {
        color: #ffffff !important;
      }
      .user-summary {
        background-color: #1a1a1a !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }
      .user-name {
        color: #ffffff !important;
      }
      .user-email {
        color: #a0aec0 !important;
      }
      .dialog-actions {
        border-top-color: rgba(255, 255, 255, 0.1) !important;
      }
      ::ng-deep .mat-mdc-form-field {
        .mat-mdc-input-element {
          color: #ffffff !important;
        }
        .mdc-floating-label, .mat-mdc-floating-label {
          color: #a0aec0 !important;
        }
        .mdc-notched-outline__leading,
        .mdc-notched-outline__notch,
        .mdc-notched-outline__trailing {
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
      }
      ::ng-deep .mat-mdc-select-value {
        color: #ffffff !important;
      }
      ::ng-deep .mat-mdc-select-arrow {
        color: #a0aec0 !important;
      }
      .dialog-actions button[mat-button] {
        color: #cbd5e0 !important;
      }
    }
  `]
})
export class AssignRoleDialogComponent implements OnInit {
  private roleAdminService = inject(RoleService);
  private userAdminService = inject(UserService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  user: User;
  roles: Role[] = [];
  selectedRoleId: string = '';
  loading = false;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<AssignRoleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AssignRoleDialogData
  ) {
    this.user = data.user;
    if (this.user?.role?.roleId) {
      this.selectedRoleId = this.user.role.roleId;
    }
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.roleAdminService.getRoles(0, 100).subscribe({
      next: (response: any) => {
        this.roles = response?.data?.result || [];
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to load roles in dialog:', err);
        this.loading = false;
        this.snackBar.open('Không thể tải danh sách vai trò!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  onSave(): void {
    if (!this.selectedRoleId) return;

    const selectedRole = this.roles.find(r => r.roleId === this.selectedRoleId);
    if (!selectedRole) return;

    // Check if the change involves a critical role (like Admin)
    const isCriticalRole = selectedRole.name === 'ADMIN' || this.user.role?.name === 'ADMIN';

    if (isCriticalRole) {
      const confirmData: ConfirmDialogData = {
        title: 'Xác nhận thay đổi vai trò quản trị',
        message: `Bạn có chắc chắn muốn thay đổi vai trò của người dùng "${this.user.fullName || this.user.username}" thành "${selectedRole.name}"? Đây là thay đổi bảo mật quan trọng!`,
        confirmText: 'Đồng ý',
        cancelText: 'Hủy',
        confirmColor: 'warn'
      };

      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: confirmData
      });

      confirmRef.afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this.executeAssignRole();
        }
      });
    } else {
      this.executeAssignRole();
    }
  }

  private executeAssignRole(): void {
    this.saving = true;
    this.userAdminService.assignRole(this.user.userId, this.selectedRoleId).subscribe({
      next: (response: any) => {
        this.saving = false;
        this.snackBar.open('Cập nhật vai trò người dùng thành công!', 'Đóng', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });
        this.dialogRef.close(true);
      },
      error: (err: any) => {
        console.error('Failed to assign role:', err);
        this.saving = false;
        const errorMsg = err.error?.message || 'Có lỗi xảy ra khi gán vai trò!';
        this.snackBar.open(errorMsg, 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  getFallbackAvatar(): string {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.user.fullName || this.user.username)}`;
  }
}
