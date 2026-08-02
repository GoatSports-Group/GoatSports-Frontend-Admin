import { Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GetFileUrlUseCase } from '@application/usecase/owner-application/get-file-url.usecase';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface DocumentPreviewDialogData {
  title: string;
  /** Single file mode */
  fileUrl?: string;
  /** Multi-file mode (e.g. CCCD front + back) */
  fileUrls?: string[];
  /** Optional label for each fileUrls item */
  fileLabels?: string[];
}

export interface ResolvedItem {
  url: SafeResourceUrl;
  downloadUrl: string;
  isImage: boolean;
  label?: string;
}

@Component({
  selector: 'app-document-preview-dialog',
  templateUrl: './document-preview-dialog.component.html',
  styleUrls: ['./document-preview-dialog.component.scss'],
  standalone: false
})
export class DocumentPreviewDialogComponent implements OnInit {
  private getFileUrlUseCase = inject(GetFileUrlUseCase);
  private sanitizer = inject(DomSanitizer);

  /** Single-file mode (legacy) */
  resolvedUrl: SafeResourceUrl | null = null;
  downloadUrl: string | null = null;
  isImageFile = false;

  /** Multi-file mode */
  resolvedItems: ResolvedItem[] = [];
  isMultiMode = false;

  loading = true;
  error = false;

  constructor(
    public dialogRef: MatDialogRef<DocumentPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DocumentPreviewDialogData
  ) {}

  ngOnInit(): void {
    if (this.data.fileUrls && this.data.fileUrls.length > 0) {
      this.isMultiMode = true;
      this.resolveMultiple(this.data.fileUrls, this.data.fileLabels || []);
    } else if (this.data.fileUrl) {
      this.resolveSingle(this.data.fileUrl);
    } else {
      this.loading = false;
      this.error = true;
    }
  }

  private resolveSingle(fileUrl: string): void {
    this.isImageFile = this.isImage(fileUrl);
    const url$ = this.toPublicUrl(fileUrl);
    url$.subscribe({
      next: (url) => {
        this.resolvedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.downloadUrl = url;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  private resolveMultiple(fileUrls: string[], labels: string[]): void {
    const obs = fileUrls.map(url => this.toPublicUrl(url));
    forkJoin(obs).subscribe({
      next: (urls) => {
        this.resolvedItems = urls.map((url, i) => ({
          url: this.sanitizer.bypassSecurityTrustResourceUrl(url),
          downloadUrl: url,
          isImage: this.isImage(url),
          label: labels[i] || `Ảnh ${i + 1}`
        }));
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  private toPublicUrl(fileUrl: string) {
    if (
      fileUrl.startsWith('http://') ||
      fileUrl.startsWith('https://') ||
      fileUrl.startsWith('data:image')
    ) {
      return of(fileUrl);
    }
    return this.getFileUrlUseCase.execute(fileUrl);
  }

  close(): void {
    this.dialogRef.close();
  }

  isImage(url: string): boolean {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return (
      cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.webp') ||
      cleanUrl.endsWith('.gif') ||
      url.startsWith('data:image')
    );
  }
}
