import { Inject, Injectable } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
import {
  StorageRepository,
  STORAGE_REPOSITORY_TOKEN
} from '@application/ports/persistence/storage.repository';

@Injectable({ providedIn: 'root' })
export class UploadVenueImageUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private readonly repository: StorageRepository
  ) {}

  execute(file: File): Observable<string> {
    return this.repository.getPresignedUrl(file.name, file.type, 'venues').pipe(
      switchMap(responses => {
        const presigned = responses[0];
        if (!presigned?.uploadUrl || !presigned.objectKey) {
          return throwError(() => new Error('Không nhận được đường dẫn tải ảnh từ Storage Service.'));
        }
        return this.repository.uploadToPresignedUrl(presigned.uploadUrl, file).pipe(
          map(() => presigned.objectKey)
        );
      })
    );
  }
}
