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
    .role-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .full-width {
      width: 100%;
    }
    .status-toggle-box {
      margin: 8px 0;
      ::ng-deep .mat-mdc-checkbox .mdc-label {
        color: #010000 !important;
        font-weight: 500;
      }
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 28px;
      border-top: 1px solid #E1E1E1;
      padding-top: 16px;
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
      .status-toggle-box {
        ::ng-deep .mat-mdc-checkbox .mdc-label {
          color: #ffffff !important;
        }
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
      .dialog-actions button[mat-button] {
        color: #cbd5e0 !important;
      }
    }
  `]
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
      // Collect existing permissions so we don't reset them
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
