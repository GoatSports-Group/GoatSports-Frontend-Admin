import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
    selector: 'app-reject-reason-dialog',
    imports: [
        MatDialogModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        LucideIconComponent
    ],
    templateUrl: './reject-reason-dialog.component.html',
    styleUrls: ['./reject-reason-dialog.component.scss']
})
export class RejectReasonDialogComponent {
  private dialogRef = inject(MatDialogRef<RejectReasonDialogComponent>);
  rejectReason = '';

  onCancel() {
    this.dialogRef.close(null);
  }

  onSubmit() {
    if (this.rejectReason.trim()) {
      this.dialogRef.close(this.rejectReason.trim());
    }
  }
}
