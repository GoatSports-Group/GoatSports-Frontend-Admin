import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleAdminService } from '../../../../core/services/index';
import { Role } from '../../../../core/models/role.model';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RoleDialogComponent } from './role-dialog/role-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-roles',
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit {
  private roleAdminService = inject(RoleAdminService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  roles: Role[] = [];
  displayedColumns: string[] = ['name', 'description', 'status', 'permissionsCount', 'actions'];
  loading = false;
  searchQuery = '';

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.roleAdminService.getRoles(0, 100, this.searchQuery).subscribe({
      next: (response) => {
        this.roles = response?.data?.result || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load roles:', err);
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

  openRoleDialog(role?: Role): void {
    const dialogRef = this.dialog.open(RoleDialogComponent, {
      width: '450px',
      data: { role }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadRoles();
      }
    });
  }

  toggleActive(role: Role): void {
    const actionText = role.active ? 'ngưng kích hoạt' : 'kích hoạt';
    const confirmData: ConfirmDialogData = {
      title: `Xác nhận ${actionText} vai trò`,
      message: `Bạn có chắc chắn muốn ${actionText} vai trò "${role.name}"?`,
      confirmText: 'Đồng ý',
      cancelText: 'Hủy'
    };

    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: confirmData
    });

    confirmRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        const req = role.active 
          ? this.roleAdminService.deactivateRole(role.roleId)
          : this.roleAdminService.activateRole(role.roleId);

        req.subscribe({
          next: () => {
            this.snackBar.open(`Đã ${actionText} vai trò thành công!`, 'Đóng', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-success']
            });
            this.loadRoles();
          },
          error: (err) => {
            console.error(`Failed to ${role.active ? 'deactivate' : 'activate'} role:`, err);
            const errorMsg = err.error?.message || `Lỗi khi ${actionText} vai trò!`;
            this.snackBar.open(errorMsg, 'Đóng', {
              duration: 4000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-error']
            });
          }
        });
      }
    });
  }

  deleteRole(role: Role): void {
    const confirmData: ConfirmDialogData = {
      title: 'Xác nhận xóa vai trò',
      message: `Bạn có chắc chắn muốn xóa vai trò "${role.name}"? Hành động này không thể hoàn tác!`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      confirmColor: 'warn'
    };

    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: confirmData
    });

    confirmRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.roleAdminService.deleteRole(role.roleId).subscribe({
          next: () => {
            this.snackBar.open('Đã xóa vai trò thành công!', 'Đóng', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-success']
            });
            this.loadRoles();
          },
          error: (err) => {
            console.error('Failed to delete role:', err);
            const errorMsg = err.error?.message || 'Lỗi khi xóa vai trò!';
            this.snackBar.open(errorMsg, 'Đóng', {
              duration: 4000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-error']
            });
          }
        });
      }
    });
  }

  navigateToPermissions(role: Role): void {
    this.router.navigate(['/admin/roles', role.roleId, 'permissions']);
  }
}
