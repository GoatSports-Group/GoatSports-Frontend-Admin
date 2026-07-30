import { StorageRepository, STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadAvatarUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private storageRepository: StorageRepository
  ) { }

  execute(file: File): Observable<string> {
    return this.storageRepository.uploadAvatar(file);
  }
}
