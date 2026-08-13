import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Role } from '@application/dto/role/role.dto';
import { Permission } from '@application/dto/permission/permission.dto';
import { PermissionService } from '@presentation/services/permission.service';
import { RoleService } from '@presentation/services/role.service';
import { NotifyService } from '@shared/components/notify/notify.service';

export interface RolePermissionsDialogData {
  role: Role;
}

export interface PermissionGroup {
  moduleName: string;
  permissions: Permission[];
  expanded: boolean;
}

@Component({
  selector: 'app-role-permissions-dialog',
  templateUrl: './role-permissions-dialog.component.html',
  styleUrls: ['./role-permissions-dialog.component.scss'],
  standalone: false
})
export class RolePermissionsDialogComponent implements OnInit {
  private permissionAdminService = inject(PermissionService);
  private roleAdminService = inject(RoleService);
  private snackBar = inject(NotifyService);

  role!: Role;
  permissionGroups: PermissionGroup[] = [];
  selectedPermissionIds = new Set<string>();
  loading = true;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<RolePermissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RolePermissionsDialogData
  ) {
    this.role = data.role;
    this.selectedPermissionIds = new Set(this.role.permissions?.map(p => p.permissionId) || []);
  }

  ngOnInit(): void {
    this.loadAllPermissions();
  }

  loadAllPermissions(): void {
    this.loading = true;
    this.permissionAdminService.getPermissions({
      page: 0,
      size: 1000 // Get all permissions
    }).subscribe({
      next: (res) => {
        const allPermissions = res.result || [];
        
        // Group permissions by module
        const groupsMap = new Map<string, Permission[]>();
        allPermissions.forEach(p => {
          const moduleName = p.module || 'Khác';
          if (!groupsMap.has(moduleName)) {
            groupsMap.set(moduleName, []);
          }
          groupsMap.get(moduleName)!.push(p);
        });

        this.permissionGroups = Array.from(groupsMap.keys()).map(moduleName => {
          // Sort permissions in each group alphabetically by name
          const sortedPerms = groupsMap.get(moduleName)!.sort((a, b) => a.name.localeCompare(b.name));
          return {
            moduleName,
            permissions: sortedPerms,
            expanded: false
          };
        }).sort((a, b) => a.moduleName.localeCompare(b.moduleName));

        // Default expand the first group
        if (this.permissionGroups.length > 0) {
          this.permissionGroups[0].expanded = true;
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
        this.dialogRef.close();
      }
    });
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

  // Group selection helpers
  isGroupAllSelected(group: PermissionGroup): boolean {
    return group.permissions.length > 0 && 
      group.permissions.every(p => this.isPermissionSelected(p.permissionId));
  }

  isGroupIndeterminate(group: PermissionGroup): boolean {
    const selectedCount = group.permissions.filter(p => this.isPermissionSelected(p.permissionId)).length;
    return selectedCount > 0 && selectedCount < group.permissions.length;
  }

  toggleGroup(group: PermissionGroup, checked: boolean): void {
    group.permissions.forEach(p => {
      this.togglePermission(p.permissionId, checked);
    });
  }

  // All permissions helpers
  isAllSelected(): boolean {
    const totalPermissionsCount = this.getTotalPermissionsCount();
    return totalPermissionsCount > 0 && this.selectedPermissionIds.size === totalPermissionsCount;
  }

  isAllIndeterminate(): boolean {
    const totalPermissionsCount = this.getTotalPermissionsCount();
    return this.selectedPermissionIds.size > 0 && this.selectedPermissionIds.size < totalPermissionsCount;
  }

  toggleAll(checked: boolean): void {
    this.permissionGroups.forEach(group => {
      group.permissions.forEach(p => {
        this.togglePermission(p.permissionId, checked);
      });
    });
  }

  getTotalPermissionsCount(): number {
    return this.permissionGroups.reduce((acc, g) => acc + g.permissions.length, 0);
  }

  toggleGroupExpand(group: PermissionGroup): void {
    group.expanded = !group.expanded;
  }

  onSave(): void {
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
        this.snackBar.open(`Đã cập nhật danh sách quyền hạn cho vai trò "${this.role.name}" thành công!`, 'Đóng', {
          duration: 3500,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });
        this.dialogRef.close(true);
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
    this.dialogRef.close(false);
  }
}
