import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleService } from '@presentation/services/role.service';
import { Role } from '@application/dto/role/role.dto';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RoleDialogComponent } from './role-dialog/role-dialog.component';
import { RolePermissionsDialogComponent } from './role-permissions-dialog/role-permissions-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { PageEvent } from '@angular/material/paginator';
import { buildRsqlSearch } from '@shared/utils/api.helper';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-roles',
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
  standalone: false
})
export class RolesComponent implements OnInit {
  private roleAdminService = inject(RoleService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  roles: Role[] = [];
  displayedColumns: string[] = ['name', 'description', 'status', 'permissionsCount', 'actions'];
  loading = false;
  searchQuery = '';

  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;

  // Stats Card data
  totalRolesCount = 0;
  activeRolesCount = 0;
  inactiveRolesCount = 0;

  statCards = [
    { id: 'total', title: 'Tổng số vai trò', count: 0, icon: 'shield' },
    { id: 'active', title: 'Kích hoạt', count: 0, icon: 'shield-check' },
    { id: 'inactive', title: 'Chưa kích hoạt', count: 0, icon: 'shield-alert' }
  ];

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.statCards, event.previousIndex, event.currentIndex);
  }

  loadStats(): void {
    this.roleAdminService.getRoles({ page: 0, size: 1000 }).subscribe({
      next: (response) => {
        if (response && response.result) {
          const allRoles = response.result || [];
          this.totalRolesCount = allRoles.length;
          this.activeRolesCount = allRoles.filter(r => r.active).length;
          this.inactiveRolesCount = allRoles.filter(r => !r.active).length;
          this.updateStatCards();
        }
      },
      error: (err) => {
        console.error('Failed to load role stats:', err);
      }
    });
  }

  updateStatCards(): void {
    const totalCard = this.statCards.find(c => c.id === 'total');
    if (totalCard) totalCard.count = this.totalRolesCount;

    const activeCard = this.statCards.find(c => c.id === 'active');
    if (activeCard) activeCard.count = this.activeRolesCount;

    const inactiveCard = this.statCards.find(c => c.id === 'inactive');
    if (inactiveCard) inactiveCard.count = this.inactiveRolesCount;
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadStats();
  }

  loadRoles(): void {
    this.loading = true;
    this.roleAdminService.getRoles({
      page: this.pageIndex,
      size: this.pageSize,
      filter: buildRsqlSearch(this.searchQuery, ['name', 'description'])
    }).subscribe({
      next: (response) => {
        this.roles = response.result || [];

        if (this.roles.length < this.pageSize) {
          this.totalItems = this.pageIndex * this.pageSize + this.roles.length;
        } else {
          this.totalItems = (this.pageIndex + 2) * this.pageSize;
        }

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

  onSearch(): void {
    this.pageIndex = 0;
    this.loadRoles();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRoles();
  }

  openRoleDialog(role?: Role): void {
    const dialogRef = this.dialog.open(RoleDialogComponent, {
      width: '450px',
      data: { role },
      panelClass: 'custom-premium-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadRoles();
        this.loadStats();
      }
    });
  }

  toggleActive(role: Role): void {
    const actionText = role.active ? 'ngưng kích hoạt' : 'kích hoạt';
    const confirmData: ConfirmDialogData = {
      title: `Xác nhận ${actionText} vai trò`,
      message: `Bạn có chắc chắn muốn ${actionText} vai trò ${role.name}?`,
      confirmText: 'Đồng ý',
      cancelText: 'Hủy',
      confirmColor: role.active ? 'warn' : 'primary'
    };

    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: confirmData,
      panelClass: 'custom-premium-dialog'
    });

    confirmRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        const req = role.active
          ? this.roleAdminService.deactivateRole(role.roleId)
          : this.roleAdminService.activateRole(role.roleId);

        req.subscribe({
          next: () => {
            this.snackBar.open(`Đã ${actionText} vai trò thành công!`, 'Đóng', {
              duration: 2000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['snackbar-success']
            });
            this.loadRoles();
            this.loadStats();
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
      width: '450px',
      data: confirmData,
      panelClass: 'custom-premium-dialog'
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
            this.loadStats();
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

  openPermissionsDialog(role: Role): void {
    const dialogRef = this.dialog.open(RolePermissionsDialogComponent, {
      width: '700px',
      data: { role },
      panelClass: 'custom-premium-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadRoles();
        this.loadStats();
      }
    });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.pageIndex = 0;
    this.loadRoles();
  }

  goToPage(page: number): void {
    this.pageIndex = page;
    this.loadRoles();
  }
}
