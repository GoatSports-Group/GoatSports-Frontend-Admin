import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RoleService } from '@presentation/services/role.service';
import { PermissionService } from '@presentation/services/permission.service';
import { Role } from '@application/dto/role/role.dto';
import { Permission } from '@application/dto/permission/permission.dto';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { buildRsqlSearch } from '@shared/utils/api.helper';

@Component({
  selector: 'app-assign-permissions',
  templateUrl: './assign-permissions.component.html',
  styleUrls: ['./assign-permissions.component.scss']
})
export class AssignPermissionsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roleAdminService = inject(RoleService);
  private permissionAdminService = inject(PermissionService);
  private snackBar = inject(MatSnackBar);

  roleId = '';
  role?: Role;
  permissions: Permission[] = [];
  selectedPermissionIds = new Set<string>();

  displayedColumns: string[] = ['select', 'name', 'apiPath', 'method', 'module'];
  loading = true;
  saving = false;
  searchQuery = '';

  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;

  ngOnInit(): void {
    this.roleId = this.route.snapshot.paramMap.get('id') || '';
    if (this.roleId) {
      this.loadRoleAndPermissions();
    } else {
      this.router.navigate(['/admin/roles']);
    }
  }

  loadRoleAndPermissions(): void {
    this.loading = true;

    if (!this.role) {
      forkJoin({
        role: this.roleAdminService.getRoleById(this.roleId),
        permissionsPage: this.permissionAdminService.getPermissions({
          page: this.pageIndex,
          size: this.pageSize,
          filter: buildRsqlSearch(this.searchQuery, ['name', 'apiPath', 'method', 'module'])
        })
      }).subscribe({
        next: (res) => {
          this.role = res.role;
          this.selectedPermissionIds = new Set(this.role?.permissions?.map(p => p.permissionId) || []);
          this.permissions = res.permissionsPage || [];

          if (this.permissions.length < this.pageSize) {
            this.totalItems = this.pageIndex * this.pageSize + this.permissions.length;
          } else {
            this.totalItems = (this.pageIndex + 2) * this.pageSize;
          }
          this.loading = false;
        },
        error: (err) => this.handleLoadError(err)
      });
    } else {
      this.permissionAdminService.getPermissions({
        page: this.pageIndex,
        size: this.pageSize,
        filter: buildRsqlSearch(this.searchQuery, ['name', 'apiPath', 'method', 'module'])
      }).subscribe({
        next: (permissions) => {
          this.permissions = permissions;
          if (permissions.length < this.pageSize) {
            this.totalItems = this.pageIndex * this.pageSize + permissions.length;
          } else {
            this.totalItems = (this.pageIndex + 2) * this.pageSize;
          }
          this.loading = false;
        },
        error: (err) => this.handleLoadError(err)
      });
    }
  }

  handleLoadError(err: any): void {
    console.error('Failed to load role or permission details:', err);
    this.loading = false;
    this.snackBar.open('Không thể tải thông tin vai trò hoặc quyền hạn!', 'Đóng', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-error']
    });
    this.router.navigate(['/admin/roles']);
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadRoleAndPermissions();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRoleAndPermissions();
  }

  isPermissionSelected(permissionId: string): boolean {
    return this.selectedPermissionIds.has(permissionId);
  }

  togglePermission(permissionId: string, checked: boolean): void {
    if (checked) {
      this.selectedPermissionIds.add(permissionId);
    } else {
      this.selectedPermissionIds.delete(permissionId);
    }
  }

  toggleAllOnPage(checked: boolean): void {
    this.permissions.forEach(p => {
      this.togglePermission(p.permissionId, checked);
    });
  }

  isAllOnPageSelected(): boolean {
    return this.permissions.length > 0 && this.permissions.every(p => this.isPermissionSelected(p.permissionId));
  }

  isSomeOnPageSelected(): boolean {
    const selectedCount = this.permissions.filter(p => this.isPermissionSelected(p.permissionId)).length;
    return selectedCount > 0 && selectedCount < this.permissions.length;
  }

  onSave(): void {
    if (!this.role) return;

    this.saving = true;

    const payload = {
      roleId: this.role.roleId,
      name: this.role.name,
      description: this.role.description,
      active: this.role.active,
      permissionIds: Array.from(this.selectedPermissionIds)
    };

    this.roleAdminService.updateRole(payload).subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(`Đã cập nhật danh sách quyền hạn cho vai trò "${this.role?.name}" thành công!`, 'Đóng', {
          duration: 3500,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });
        this.router.navigate(['/admin/roles']);
      },
      error: (err) => {
        console.error('Failed to update role permissions:', err);
        this.saving = false;
        const errorMsg = err.error?.message || 'Có lỗi xảy ra khi cập nhật quyền hạn!';
        this.snackBar.open(errorMsg, 'Đóng', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/admin/roles']);
  }
}
