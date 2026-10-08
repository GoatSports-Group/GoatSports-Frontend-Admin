import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.models';

/** Popup xac nhan chung cua admin (thay window.confirm). Phat true khi nguoi dung bam nut xac nhan. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  ask(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
      panelClass: 'custom-premium-dialog'
    }).afterClosed().pipe(map(result => result === true));
  }
}
