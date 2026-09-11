import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import {
  OwnerApplicationApi,
  OwnerApplicationDocumentSlot,
  PrepareOwnerApplicationUploadRequest,
  SubmitOwnerApplicationRequest
} from '@infrastructure/api/owner-application.api';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);

  submit(
    form: Record<string, unknown>,
    files: { idCardFront: File; idCardBack: File; businessLicense: File; venueImage: File }
  ): Observable<void> {
    const uploads: Array<{ file: File; slot: OwnerApplicationDocumentSlot }> = [
      { file: files.idCardFront, slot: 'IDENTITY_FRONT' },
      { file: files.idCardBack, slot: 'IDENTITY_BACK' },
      { file: files.businessLicense, slot: 'BUSINESS_LICENSE' },
      { file: files.venueImage, slot: 'VENUE_PHOTO' }
    ];
    const prepareRequest: PrepareOwnerApplicationUploadRequest = {
      documents: uploads.map(item => ({
        slot: item.slot,
        fileName: item.file.name,
        contentType: item.file.type || 'application/octet-stream'
      }))
    };
    const idempotencyKey = `owner-application:${crypto.randomUUID()}`;

    return this.ownerApplicationApi.prepareUploads(prepareRequest, idempotencyKey).pipe(
      switchMap(response => {
        const prepared = response.data;
        if (!prepared?.ownerApplicationId || prepared.documents.length !== uploads.length) {
          throw new Error('Không thể chuẩn bị nơi tải hồ sơ lên.');
        }

        const documentsBySlot = new Map(
          prepared.documents.map(document => [document.slot, document])
        );
        const uploadRequests = uploads.map(item => {
          const document = documentsBySlot.get(item.slot);
          if (!document?.uploadUrl || !document.objectKey) {
            throw new Error(`Thiếu đường dẫn tải lên cho ${item.slot}.`);
          }
          return this.ownerApplicationApi.upload(document.uploadUrl, item.file).pipe(
            map(() => ({ slot: item.slot, objectKey: document.objectKey }))
          );
        });
        const objectKeys = prepared.documents.map(document => document.objectKey);

        return forkJoin(uploadRequests).pipe(
          catchError(error => this.ownerApplicationApi.cleanupUploads(
            prepared.ownerApplicationId,
            objectKeys
          ).pipe(
            catchError(() => of(void 0)),
            switchMap(() => throwError(() => error))
          )),
          switchMap(documents => {
            const submitRequest: SubmitOwnerApplicationRequest = {
              ...form,
              ownerApplicationId: prepared.ownerApplicationId,
              documents
            };
            return this.ownerApplicationApi.submitApplication(submitRequest);
          })
        );
      }),
      map(() => undefined)
    );
  }

  getAllApplications(filter: PageFilter): Observable<BaseListResponse<OwnerApplication>> {
    return this.ownerApplicationApi.getAllApplications(filter).pipe(
      map(response => response.data)
    );
  }

  getMyApplications(filter?: PageFilter): Observable<BaseListResponse<OwnerApplication>> {
    return this.ownerApplicationApi.getMyApplications(filter).pipe(
      map(response => response.data)
    );
  }

  getApplicationDetail(id: string): Observable<OwnerApplication> {
    return this.ownerApplicationApi.getApplicationDetail(id).pipe(
      map(response => response.data)
    );
  }

  markViewed(id: string): Observable<void> {
    return this.ownerApplicationApi.markViewed(id).pipe(map(() => undefined));
  }

  approve(id: string): Observable<void> {
    return this.ownerApplicationApi.approve(id).pipe(map(() => undefined));
  }

  reject(id: string, rejectReason: string): Observable<void> {
    return this.ownerApplicationApi.reject(id, rejectReason).pipe(map(() => undefined));
  }

  getFileUrl(key: string): Observable<string> {
    return this.ownerApplicationApi.getFileUrl(key);
  }
}
