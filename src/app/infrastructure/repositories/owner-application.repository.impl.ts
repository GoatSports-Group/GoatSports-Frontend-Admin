import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  exhaustMap,
  filter,
  forkJoin,
  map,
  of,
  switchMap,
  take,
  throwError,
  timeout,
  timer
} from 'rxjs';
import {
  OwnerApplicationFiles,
  OwnerApplicationRepository,
  OwnerFaceReadiness,
  PreparedOwnerIdentity
} from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import {
  OwnerApplicationApi,
  OwnerApplicationDocumentSlot,
  OwnerIdentityVerificationResponse,
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

  analyzeFaceReadiness(frame: string): Observable<OwnerFaceReadiness> {
    return this.ownerApplicationApi.analyzeFaceReadiness(frame).pipe(map(response => response.data));
  }

  verifyIdentity(files: OwnerApplicationFiles, livenessFrames: string[]): Observable<PreparedOwnerIdentity> {
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
          switchMap(documents => {
            const front = documents.find(document => document.slot === 'IDENTITY_FRONT');
            const back = documents.find(document => document.slot === 'IDENTITY_BACK');
            if (!front || !back) throw new Error('Thiếu ảnh CCCD để xác minh.');

            return this.ownerApplicationApi.verifyIdentity(
              prepared.ownerApplicationId,
              front.objectKey,
              back.objectKey,
              livenessFrames
            ).pipe(
              switchMap(response => this.waitForVerification(response.data)),
              map(verification => {
                if (
                  verification?.status !== 'VERIFIED'
                  || !verification.document?.fullName
                  || !verification.document.identityNumber
                ) {
                  throw new Error(verification?.message || 'CCCD hoặc khuôn mặt chưa được xác minh.');
                }
                return {
                  ownerApplicationId: prepared.ownerApplicationId,
                  identityVerificationId: verification.verificationId,
                  fullName: verification.document.fullName,
                  identityNumber: verification.document.identityNumber,
                  documents
                };
              })
            );
          }),
          catchError(error => this.ownerApplicationApi.cleanupUploads(
            prepared.ownerApplicationId,
            objectKeys
          ).pipe(
            catchError(() => of(void 0)),
            switchMap(() => throwError(() => error))
          ))
        );
      })
    );
  }

  private waitForVerification(
    verification: OwnerIdentityVerificationResponse
  ): Observable<OwnerIdentityVerificationResponse> {
    if (!verification?.verificationId || verification.status !== 'PROCESSING') {
      return of(verification);
    }
    return timer(0, 1000).pipe(
      exhaustMap(() => this.ownerApplicationApi.getIdentityVerification(verification.verificationId).pipe(
        map(response => response.data),
        catchError(error => this.isTransientPollingError(error)
          ? of(null)
          : throwError(() => error))
      )),
      filter((result): result is OwnerIdentityVerificationResponse => result !== null),
      filter(result => result.status !== 'PROCESSING'),
      timeout({
        first: 120000,
        with: () => throwError(() => new Error(
          'Quá thời gian xác minh CCCD và khuôn mặt. Vui lòng thử lại.'
        ))
      }),
      take(1)
    );
  }

  private isTransientPollingError(error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status;
    return status === 0 || status === 502 || status === 503 || status === 504;
  }

  submit(form: Record<string, unknown>, preparedIdentity: PreparedOwnerIdentity): Observable<void> {
    const submitRequest: SubmitOwnerApplicationRequest = {
      ...form,
      ownerApplicationId: preparedIdentity.ownerApplicationId,
      identityVerificationId: preparedIdentity.identityVerificationId,
      fullName: preparedIdentity.fullName,
      identityNumber: preparedIdentity.identityNumber,
      documents: preparedIdentity.documents
    };
    return this.ownerApplicationApi.submitApplication(submitRequest).pipe(map(() => undefined));
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
