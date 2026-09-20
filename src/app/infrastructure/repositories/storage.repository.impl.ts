import { Injectable, inject } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { StorageRepository } from '@application/ports/persistence/storage.repository';
import { StorageApi } from '@infrastructure/api/storage.api';
import { PresignedUrlResponse } from '@application/dto/storage/storage.dto';

@Injectable({
  providedIn: 'root'
})
export class StorageRepositoryImpl implements StorageRepository {
  private storageApi = inject(StorageApi);

  getPresignedUrl(fileName: string, contentType: string, folder: string): Observable<PresignedUrlResponse[]> {
    return this.storageApi.getPresignedUrl(fileName, contentType, folder).pipe(
      map(response => response.data)
    );
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.storageApi.uploadToPresignedUrl(uploadUrl, file);
  }

  getFileUrl(key: string): Observable<string> {
    return this.storageApi.getFileUrl(key);
  }

  uploadAvatar(file: File): Observable<string> {
    return this.storageApi.getPresignedUrl(file.name, file.type, 'avatars').pipe(
      switchMap(response => {
        const presigned = response.data[0];
        // Tra ve objectKey tam; service so huu ho so (auth-service) moi la ben goi
        // /internal/files/confirm de doi sang vung luu vinh vien.
        return this.storageApi.uploadToPresignedUrl(presigned.uploadUrl, file).pipe(
          map(() => presigned.objectKey)
        );
      })
    );
  }
}
