import { StorageRepository, STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadToPresignedUrlUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private storageRepository: StorageRepository
  ) { }

  execute(uploadUrl: string, file: File): Observable<any> {
    return this.storageRepository.uploadToPresignedUrl(uploadUrl, file);
  }
}
