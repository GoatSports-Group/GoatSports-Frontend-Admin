import { StorageRepository, STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PresignedUrlResponse } from '@application/dto/storage/storage.dto';

@Injectable({
  providedIn: 'root'
})
export class GetPresignedUrlUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private storageRepository: StorageRepository
  ) { }

  execute(fileName: string, contentType: string, folder: string): Observable<PresignedUrlResponse[]> {
    return this.storageRepository.getPresignedUrl(fileName, contentType, folder);
  }
}
