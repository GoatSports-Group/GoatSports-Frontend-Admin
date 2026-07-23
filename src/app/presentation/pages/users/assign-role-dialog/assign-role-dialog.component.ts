import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { User } from '@application/dto/user/user.dto';
import { Role } from '@application/dto/role/role.dto';
import { UserService } from '@presentation/services/user.service';
import { RoleService } from '@presentation/services/role.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';

export interface AssignRoleDialogData {
  user: User;
}

@Component({
    selector: 'app-assign-role-dialog',
    templateUrl: './assign-role-dialog.component.html',
    styleUrls: ['./assign-role-dialog.component.scss'],
    standalone: false
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
    this.roleAdminService.getRoles({ page: 0, size: 100 }).subscribe({
      next: (roles) => {
        this.roles = roles || [];
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
