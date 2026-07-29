import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { PermissionService } from '@presentation/services/permission.service';
import { Permission } from '@application/dto/permission/permission.dto';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { PermissionDialogComponent } from './permission-dialog/permission-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { buildRsqlSearch } from '@shared/utils/api.helper';

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.component.html',
  styleUrls: ['./permissions.component.scss'],
  standalone: false
})
export class PermissionsComponent implements OnInit {
  private permissionAdminService = inject(PermissionService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  permissions: Permission[] = [];
  displayedColumns: string[] = ['name', 'apiPath', 'method', 'module', 'actions'];
  loading = false;
  searchQuery = '';

  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.loading = true;
    this.permissionAdminService.getPermissions({
      page: this.pageIndex,
      size: this.pageSize,
      filter: buildRsqlSearch(this.searchQuery, ['name', 'apiPath', 'method', 'module'])
    }).subscribe({
      next: (response) => {
        this.permissions = response.result;
        if (response.result.length < this.pageSize) {
          this.totalItems = this.pageIndex * this.pageSize + response.result.length;
        } else {
          this.totalItems = (this.pageIndex + 2) * this.pageSize;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load permissions:', err);
        this.loading = false;
        this.snackBar.open('Không thể tải danh sách quyền hạn!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadPermissions();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPermissions();
  }

  openPermissionDialog(permission?: Permission): void {
    const dialogRef = this.dialog.open(PermissionDialogComponent, {
      width: '600px',
      data: { permission }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPermissions();
      }
    });
  }

  deletePermission(permission: Permission): void {
    const confirmData: ConfirmDialogData = {
      title: 'Xác nhận xóa quyền hạn',
      message: `Bạn có chắc chắn muốn xóa quyền hạn "${permission.name}" (${permission.method} ${permission.apiPath})? Thao tác này không thể phục hồi!`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      confirmColor: 'warn'
    };

    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: confirmData
    });

    confirmRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.permissionAdminService.deletePermission(permission.permissionId).subscribe({
          next: () => {
            this.snackBar.open('Đã xóa quyền hạn thành công!', 'Đóng', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-success']
            });
            this.loadPermissions();
          },
          error: (err) => {
            console.error('Failed to delete permission:', err);
            const errorMsg = err.error?.message || 'Có lỗi xảy ra khi xóa quyền hạn!';
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
}
