import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RoleAdminService, PermissionAdminService } from '../../../../../core/services/index';
import { Role } from '../../../../../core/models/role.model';
import { Permission } from '../../../../../core/models/permission.model';
import { MatSnackBar } from '@angular/material/snack-bar';

interface PermissionSelection {
  permission: Permission;
  checked: boolean;
}

interface GroupedPermissions {
  [module: string]: PermissionSelection[];
}

@Component({
  selector: 'app-assign-permissions',
  templateUrl: './assign-permissions.component.html',
  styleUrls: ['./assign-permissions.component.scss']
})
export class AssignPermissionsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roleAdminService = inject(RoleAdminService);
  private permissionAdminService = inject(PermissionAdminService);
  private snackBar = inject(MatSnackBar);

  roleId = '';
  role?: Role;
  groupedPermissions: GroupedPermissions = {};
  moduleKeys: string[] = [];
  
  loading = true;
  saving = false;

  ngOnInit(): void {
    this.roleId = this.route.snapshot.paramMap.get('id') || '';
    if (this.roleId) {
      this.loadData();
    } else {
      this.router.navigate(['/admin/roles']);
    }
  }

  loadData(): void {
    this.loading = true;
    
    forkJoin({
      roleResponse: this.roleAdminService.getRoleById(this.roleId),
      permissionsResponse: this.permissionAdminService.getPermissions(0, 1000)
    }).subscribe({
      next: (res) => {
        this.role = res.roleResponse.data;
        const allPermissions = res.permissionsResponse.data?.result || [];
        
        // Map role's current permissions into a lookup set
        const activePermissionIds = new Set(this.role?.permissions?.map(p => p.permissionId) || []);

        this.groupPermissions(allPermissions, activePermissionIds);
        this.loading = false;
      },
      error: (err) => {
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
    });
  }

  private groupPermissions(allPermissions: Permission[], activePermissionIds: Set<string>): void {
    const grouped: GroupedPermissions = {};

    allPermissions.forEach(permission => {
      // Normalize module name to uppercase for clean grouping
      const moduleName = (permission.module || 'OTHER').toUpperCase().trim();
      
      if (!grouped[moduleName]) {
        grouped[moduleName] = [];
      }

      grouped[moduleName].push({
        permission,
        checked: activePermissionIds.has(permission.permissionId)
      });
    });

    // Sort permissions within each module by name
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.permission.name.localeCompare(b.permission.name));
    });

    this.groupedPermissions = grouped;
    // Sort modules alphabetically so they display nicely
    this.moduleKeys = Object.keys(grouped).sort();
  }

  toggleSelectAll(module: string, selectAll: boolean): void {
    const list = this.groupedPermissions[module];
    if (list) {
      list.forEach(item => item.checked = selectAll);
    }
  }

  isModuleAllSelected(module: string): boolean {
    const list = this.groupedPermissions[module];
    return list ? list.every(item => item.checked) : false;
  }

  isModulePartiallySelected(module: string): boolean {
    const list = this.groupedPermissions[module];
    if (!list) return false;
    const selectedCount = list.filter(item => item.checked).length;
    return selectedCount > 0 && selectedCount < list.length;
  }

  onSave(): void {
    if (!this.role) return;

    this.saving = true;

    // Collect all checked permission IDs
    const selectedPermissionIds: string[] = [];
    this.moduleKeys.forEach(module => {
      this.groupedPermissions[module].forEach(item => {
        if (item.checked) {
          selectedPermissionIds.push(item.permission.permissionId);
        }
      });
    });

    const payload = {
      roleId: this.role.roleId,
      name: this.role.name,
      description: this.role.description,
      active: this.role.active,
      permissionIds: selectedPermissionIds
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
