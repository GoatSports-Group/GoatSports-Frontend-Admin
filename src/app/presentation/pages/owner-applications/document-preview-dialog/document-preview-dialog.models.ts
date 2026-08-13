import { SafeResourceUrl } from '@angular/platform-browser';

export interface DocumentPreviewDialogData {
  title: string;
  fileUrl?: string;
  fileUrls?: string[];
  fileLabels?: string[];
}

export interface ResolvedItem {
  url: SafeResourceUrl;
  downloadUrl: string;
  isImage: boolean;
  label?: string;
}
