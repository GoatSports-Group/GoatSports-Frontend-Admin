import { StorageRepository, STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfirmUploadUseCase {
  constructor(
    @Inject(STORAGE_REPOSITORY_TOKEN) private storageRepository: StorageRepository
  ) { }

  execute(tempKey: string): Observable<string[]> {
    return this.storageRepository.confirmUpload(tempKey);
  }
}
