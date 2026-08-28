import { Injectable, inject } from '@angular/core';
import { Observable, catchError, exhaustMap, filter, forkJoin, map, of, retry, switchMap, take, timeout, timer } from 'rxjs';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import { OwnerApplicationApi } from '@infrastructure/api/owner-application.api';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';
import { WorkflowApi } from '@infrastructure/api/workflow.api';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);
  private workflowApi = inject(WorkflowApi);

  submit(
    form: Record<string, unknown>,
    files: { idCardFront: File; idCardBack: File; businessLicense: File; venueImage: File }
  ): Observable<BaseListResponse<OwnerApplication>> {
    const uploads = [
      { file: files.idCardFront, folder: 'identities' },
      { file: files.idCardBack, folder: 'identities' },
      { file: files.businessLicense, folder: 'licenses' },
      { file: files.venueImage, folder: 'venues' }
    ];
    const presignedRequests = uploads.map(item => ({
      fileName: item.file.name,
      contentType: item.file.type,
      folder: item.folder
    }));

    return this.workflowApi.start({ ...form, presignedRequests }).pipe(
      switchMap(response => timer(0, 1500).pipe(
        exhaustMap(() => this.workflowApi.variables(response.data.processInstanceKey).pipe(
          retry({ count: 4, delay: 500 })
        )),
        map(result => ({ instanceKey: response.data.processInstanceKey, variables: result.data })),
        filter(result => Boolean(
          result.variables.ownerApplicationId && result.variables.presignedUrls?.length === uploads.length
        )),
        take(1),
        timeout({ first: 45000 })
      )),
      switchMap(result => forkJoin(uploads.map((item, index) => {
        const presigned = result.variables.presignedUrls?.[index];
        if (!presigned) throw new Error('WORKFLOW_PRESIGNED_URL_MISSING');
        return this.workflowApi.upload(presigned.uploadUrl, item.file).pipe(
          retry({ count: 2, delay: 750 }),
          map(() => presigned.objectKey)
        );
      })).pipe(map(documentKeys => ({ instanceKey: result.instanceKey, documentKeys })))),
      switchMap(result => timer(0, 1000).pipe(
        exhaustMap(() => this.workflowApi.task(result.instanceKey).pipe(retry({ count: 4, delay: 500 }))),
        map(response => response.data),
        filter(task => task?.elementId === 'Task_UserUpload'),
        take(1),
        timeout({ first: 45000 }),
        switchMap(task => this.workflowApi.complete(task!.key, { documentKeys: result.documentKeys }))
      )),
      switchMap(() => this.getMyApplications())
    );
  }

  getAllApplications(filter: PageFilter): Observable<BaseListResponse<OwnerApplication>> {
    return this.ownerApplicationApi.getAllApplications(filter).pipe(
      map(response => response.data)
    );
  }

  getMyApplications(filter?: PageFilter): Observable<BaseListResponse<OwnerApplication>> {
    return this.ownerApplicationApi.getMyApplications(filter).pipe(
      map(response => response.data),
      switchMap(response => {
        const applications = response.result ?? [];
        if (applications.length === 0) {
          return of(response);
        }

        return this.ownerApplicationApi
          .getMyApplicationProgress(applications.map(application => application.ownerApplicationId))
          .pipe(
            map(progressResponse => {
              const progressById = new Map(
                (progressResponse.data?.items ?? []).map(progress => [progress.ownerApplicationId, progress])
              );
              return {
                ...response,
                result: applications.map(application => ({
                  ...application,
                  ...progressById.get(application.ownerApplicationId)
                }))
              };
            }),
            catchError(() => of(response))
          );
      })
    );
  }

  getApplicationDetail(id: string): Observable<OwnerApplication> {
    return this.ownerApplicationApi.getApplicationDetail(id).pipe(
      map(response => response.data)
    );
  }

  markViewed(id: string): Observable<void> {
    return this.ownerApplicationApi.markViewed(id).pipe(
      map(() => undefined)
    );
  }

  approve(id: string): Observable<void> {
    return this.ownerApplicationApi.approve(id).pipe(
      map(() => undefined)
    );
  }

  reject(id: string, rejectReason: string): Observable<void> {
    return this.ownerApplicationApi.reject(id, rejectReason).pipe(
      map(() => undefined)
    );
  }

  getFileUrl(key: string): Observable<string> {
    return this.ownerApplicationApi.getFileUrl(key);
  }
}
