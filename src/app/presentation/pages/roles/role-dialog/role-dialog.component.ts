import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Role } from '@application/dto/role/role.dto';
import { RoleService } from '@presentation/services/role.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface RoleDialogData {
  role?: Role;
}

@Component({
  selector: 'app-role-dialog',
  templateUrl: './role-dialog.component.html',
  styleUrls: ['./role-dialog.component.scss']
})
export class RoleDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private roleAdminService = inject(RoleService);
  private snackBar = inject(MatSnackBar);

  roleForm!: FormGroup;
  isEditMode = false;
  role?: Role;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<RoleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoleDialogData
  ) {
    this.role = data.role;
    this.isEditMode = !!this.role;
  }

  ngOnInit(): void {
    this.roleForm = this.fb.group({
      name: [this.role?.name || '', [Validators.required, Validators.maxLength(100)]],
      description: [this.role?.description || '', [Validators.maxLength(250)]],
      active: [this.role ? this.role.active : true]
    });
  }

  onSubmit(): void {
    if (this.roleForm.invalid) return;

    this.saving = true;
    const formVal = this.roleForm.value;

    if (this.isEditMode && this.role) {
      const permissionIds = this.role.permissions?.map((p: any) => p.permissionId) || [];
      const payload = {
        roleId: this.role.roleId,
        name: formVal.name.trim(),
        description: formVal.description.trim(),
        active: formVal.active,
        permissionIds
      };

      this.roleAdminService.updateRole(payload).subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open('Cập nhật thông tin vai trò thành công!', 'Đóng', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
          });
          this.dialogRef.close(true);
        },
        error: (err: any) => {
          console.error('Failed to update role:', err);
          this.saving = false;
          const errorMsg = err.error?.message || 'Lỗi khi cập nhật vai trò!';
          this.snackBar.open(errorMsg, 'Đóng', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-error']
          });
        }
      });
    } else {
      const payload = {
        name: formVal.name.trim(),
        description: formVal.description.trim()
      };

      this.roleAdminService.createRole(payload).subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open('Tạo vai trò mới thành công!', 'Đóng', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['snackbar-success']
          });
          this.dialogRef.close(true);
        },
        error: (err: any) => {
          console.error('Failed to create role:', err);
          this.saving = false;
          const errorMsg = err.error?.message || 'Lỗi khi tạo vai trò mới!';
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
