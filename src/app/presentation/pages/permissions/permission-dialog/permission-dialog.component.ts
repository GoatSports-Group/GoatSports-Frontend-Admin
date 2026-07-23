import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Permission } from '@application/dto/permission/permission.dto';
import { PermissionService } from '@presentation/services/permission.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface PermissionDialogData {
  permission?: Permission;
}

@Component({
    selector: 'app-permission-dialog',
    templateUrl: './permission-dialog.component.html',
    styleUrls: ['./permission-dialog.component.scss'],
    standalone: false
})
export class PermissionDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private permissionAdminService = inject(PermissionService);
  private snackBar = inject(MatSnackBar);

  permissionForm!: FormGroup;
  isEditMode = false;
  permission?: Permission;
  saving = false;

  methods: string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  constructor(
    public dialogRef: MatDialogRef<PermissionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PermissionDialogData
  ) {
    this.permission = data.permission;
    this.isEditMode = !!this.permission;
  }

  ngOnInit(): void {
    this.permissionForm = this.fb.group({
      name: [this.permission?.name || '', [Validators.required, Validators.maxLength(100)]],
      apiPath: [this.permission?.apiPath || '', [Validators.required, Validators.maxLength(250)]],
      method: [this.permission?.method || 'GET', [Validators.required]],
      module: [this.permission?.module || 'USER', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.permissionForm.invalid) return;

    this.saving = true;
    const formVal = this.permissionForm.value;

    if (this.isEditMode && this.permission) {
      const payload: Permission = {
        permissionId: this.permission.permissionId,
        name: formVal.name.trim(),
        apiPath: formVal.apiPath.trim(),
        method: formVal.method,
        module: formVal.module
      };

      this.permissionAdminService.updatePermission(payload).subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open('Cập nhật quyền hạn thành công!', 'Đóng', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
          });
          this.dialogRef.close(true);
        },
        error: (err: any) => {
          console.error('Failed to update permission:', err);
          this.saving = false;
          const errorMsg = err.error?.message || 'Lỗi khi cập nhật quyền hạn!';
          this.snackBar.open(errorMsg, 'Đóng', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-error']
          });
        }
      });
    } else {
      const payload: Partial<Permission> = {
        name: formVal.name.trim(),
        apiPath: formVal.apiPath.trim(),
        method: formVal.method,
        module: formVal.module
      };

      this.permissionAdminService.createPermission(payload).subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open('Tạo quyền hạn mới thành công!', 'Đóng', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
          });
          this.dialogRef.close(true);
        },
        error: (err: any) => {
          console.error('Failed to create permission:', err);
          this.saving = false;
          const errorMsg = err.error?.message || 'Lỗi khi tạo quyền hạn mới!';
          this.snackBar.open(errorMsg, 'Đóng', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-error']
          });
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
