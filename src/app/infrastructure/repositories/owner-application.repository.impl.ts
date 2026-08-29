import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, exhaustMap, filter, forkJoin, map, of, retry, switchMap, take, throwError, timeout, timer } from 'rxjs';
import { OwnerApplicationRepository } from '@application/ports/persistence/owner-application.repository';
import { OwnerApplication } from '@domain/entities/owner-application';
import { OwnerApplicationApi } from '@infrastructure/api/owner-application.api';
import { PageFilter } from '@application/dto/page.filter';
import { BaseListResponse } from '@application/dto/base/base-response';
import { WorkflowApi, WorkflowVariables } from '@infrastructure/api/workflow.api';

@Injectable({
  providedIn: 'root'
})
export class OwnerApplicationRepositoryImpl implements OwnerApplicationRepository {
  private ownerApplicationApi = inject(OwnerApplicationApi);
  private workflowApi = inject(WorkflowApi);

  submit(
    form: Record<string, unknown>,
    files: { idCardFront: File; idCardBack: File; businessLicense: File; venueImage: File }
  ): Observable<void> {
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

    const workflow = this.withTimeout(
      this.workflowApi.start({ ...form, presignedRequests }),
      15000,
      'Không thể kết nối hệ thống workflow. Vui lòng kiểm tra Camunda và xem lịch sử đơn trước khi thử lại.'
    ).pipe(
      switchMap(response => this.withTimeout(timer(0, 2000).pipe(
        exhaustMap(() => this.workflowApi.variables(response.data.processInstanceKey).pipe(
          retry({ count: 2, delay: 750 })
        )),
        map(result => ({ instanceKey: response.data.processInstanceKey, variables: result.data })),
        map(result => {
          this.assertWorkflowActive(result.variables, 'Workflow đã dừng trước khi tạo xong hồ sơ chủ sân.');
          return result;
        }),
        filter(result => Boolean(
          result.variables.ownerApplicationId && result.variables.presignedUrls?.length === uploads.length
        )),
        take(1)
      ), 45000, 'Workflow chưa tạo xong hồ sơ hoặc URL tải lên. Vui lòng kiểm tra trạng thái các worker.')),
      switchMap(result => forkJoin(uploads.map((item, index) => {
        const presigned = result.variables.presignedUrls?.[index];
        if (!presigned) throw new Error('WORKFLOW_PRESIGNED_URL_MISSING');
        return this.withTimeout(
          this.workflowApi.upload(presigned.uploadUrl, item.file).pipe(retry({ count: 2, delay: 750 })),
          30000,
          `Tải lên ${item.file.name} quá thời gian cho phép.`
        ).pipe(map(() => presigned.objectKey));
      })).pipe(map(documentKeys => ({ instanceKey: result.instanceKey, documentKeys })))),
      switchMap(result => this.withTimeout(timer(0, 1500).pipe(
        exhaustMap(() => this.workflowApi.task(result.instanceKey).pipe(retry({ count: 2, delay: 750 }))),
        map(response => response.data),
        filter(task => task?.elementId === 'Task_UserUpload'),
        take(1)
      ), 30000, 'Không tìm thấy bước tải hồ sơ đang chờ trong workflow.').pipe(
        switchMap(task => this.withTimeout(
          this.workflowApi.complete(task!.key, { documentKeys: result.documentKeys }),
          15000,
          'Không thể hoàn tất bước tải hồ sơ. Vui lòng kiểm tra lịch sử đơn trước khi thử lại.'
        ).pipe(map(() => result.instanceKey)))
      )),
      switchMap(instanceKey => this.withTimeout(timer(0, 1500).pipe(
        exhaustMap(() => this.workflowApi.variables(instanceKey).pipe(retry({ count: 2, delay: 750 }))),
        map(response => response.data),
        map(variables => {
          this.assertWorkflowActive(variables, 'Workflow đã dừng trước khi hoàn tất hồ sơ chủ sân.');
          return variables;
        }),
        filter(variables => variables.workflowStatus === 'SUBMITTED'),
        take(1)
      ), 30000, 'Hồ sơ đã tải lên nhưng workflow chưa xác nhận hoàn tất. Vui lòng kiểm tra lịch sử đơn.')),
      map(() => undefined)
    );

    return this.withTimeout(
      workflow,
      90000,
      'Quá thời gian xử lý hồ sơ. Tiến trình chờ đã được đóng; vui lòng kiểm tra Lịch sử đăng ký trước khi thử lại.'
    );
  }

  private assertWorkflowActive(
    variables: WorkflowVariables,
    stoppedMessage: string
  ): void {
    if (variables.workflowStatus === 'FAILED') {
      throw new Error(variables.workflowErrorMessage || stoppedMessage);
    }
    if (variables.workflowHasIncident) {
      throw new Error(variables.workflowErrorMessage || 'Workflow đang gặp sự cố và không thể tiếp tục xử lý hồ sơ.');
    }
    if (variables.workflowInstanceState && variables.workflowInstanceState !== 'ACTIVE') {
      throw new Error(variables.workflowErrorMessage || stoppedMessage);
    }
  }

  private withTimeout<T>(source: Observable<T>, milliseconds: number, message: string): Observable<T> {
    return source.pipe(
      timeout({ first: milliseconds }),
      catchError(error => error instanceof TimeoutError
        ? throwError(() => new Error(message))
        : throwError(() => error))
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
