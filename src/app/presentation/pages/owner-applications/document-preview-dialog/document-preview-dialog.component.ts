import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GetFileUrlUseCase } from '@application/usecase/owner-application/get-file-url.usecase';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface DocumentPreviewDialogData {
  title: string;
  fileUrl: string;
}

@Component({
  selector: 'app-document-preview-dialog',
  templateUrl: './document-preview-dialog.component.html',
  styleUrls: ['./document-preview-dialog.component.scss']
})
export class DocumentPreviewDialogComponent implements OnInit {
  private getFileUrlUseCase = inject(GetFileUrlUseCase);
  private sanitizer = inject(DomSanitizer);

  resolvedUrl: SafeResourceUrl | null = null;
  downloadUrl: string | null = null;
  loading = true;
  error = false;
  isImageFile = false;

  constructor(
    public dialogRef: MatDialogRef<DocumentPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DocumentPreviewDialogData
  ) {}

  ngOnInit(): void {
    const fileUrl = this.data.fileUrl;
    this.isImageFile = this.isImage(fileUrl);

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('data:image')) {
      this.resolvedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileUrl);
      this.downloadUrl = fileUrl;
      this.loading = false;
    } else {
      this.getFileUrlUseCase.execute(fileUrl).subscribe({
        next: (url) => {
          this.resolvedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.downloadUrl = url;
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          this.error = true;
          this.loading = false;
        }
      });
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  isImage(url: string): boolean {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.webp') ||
      cleanUrl.endsWith('.gif') ||
      url.startsWith('data:image');
  }
}
