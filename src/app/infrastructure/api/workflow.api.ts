import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from '@environments/environment';

export interface WorkflowStartResponse { processInstanceKey: number; }
export interface WorkflowVariables {
  ownerApplicationId?: string;
  presignedUrls?: { uploadUrl: string; objectKey: string }[];
}
export interface WorkflowTask { key: number; elementId: string; }

@Injectable({ providedIn: 'root' })
export class WorkflowApi {
  private readonly http = inject(HttpClient);
  private readonly uploadHttp = new HttpClient(inject(HttpBackend));
  private readonly baseUrl = `${environment.apiUrl}/workflow-service/api/v1/workflows`;

  start(variables: Record<string, unknown>): Observable<BaseResponse<WorkflowStartResponse>> {
    return this.http.post<BaseResponse<WorkflowStartResponse>>(`${this.baseUrl}/start`, { variables });
  }

  variables(instanceKey: number): Observable<BaseResponse<WorkflowVariables>> {
    return this.http.get<BaseResponse<WorkflowVariables>>(`${this.baseUrl}/instances/${instanceKey}/variables`);
  }

  task(instanceKey: number): Observable<BaseResponse<WorkflowTask | null>> {
    return this.http.get<BaseResponse<WorkflowTask | null>>(`${this.baseUrl}/instances/${instanceKey}/tasks`);
  }

  complete(taskKey: number, variables: Record<string, unknown>): Observable<BaseResponse<void>> {
    return this.http.post<BaseResponse<void>>(`${this.baseUrl}/tasks/${taskKey}/complete`, { variables });
  }

  upload(uploadUrl: string, file: File): Observable<void> {
    return this.uploadHttp.put<void>(uploadUrl, file, { headers: { 'Content-Type': file.type } });
  }
}
