import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PresignedUrlResponse } from '@application/dto/storage/storage.dto';
import { GetPresignedUrlUseCase } from '@application/usecase/storage/get-presigned-url.usecase';
import { UploadToPresignedUrlUseCase } from '@application/usecase/storage/upload-to-presigned-url.usecase';
import { ConfirmUploadUseCase } from '@application/usecase/storage/confirm-upload.usecase';
import { UploadAvatarUseCase } from '@application/usecase/storage/upload-avatar.usecase';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private getPresignedUrlUseCase = inject(GetPresignedUrlUseCase);
  private uploadToPresignedUrlUseCase = inject(UploadToPresignedUrlUseCase);
  private confirmUploadUseCase = inject(ConfirmUploadUseCase);
  private uploadAvatarUseCase = inject(UploadAvatarUseCase);

  getPresignedUrl(fileName: string, contentType: string, folder: string): Observable<PresignedUrlResponse[]> {
    return this.getPresignedUrlUseCase.execute(fileName, contentType, folder);
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.uploadToPresignedUrlUseCase.execute(uploadUrl, file);
  }

  confirmUpload(tempKey: string): Observable<string[]> {
    return this.confirmUploadUseCase.execute(tempKey);
  }

  uploadAvatar(file: File): Observable<string> {
    return this.uploadAvatarUseCase.execute(file);
  }
}
