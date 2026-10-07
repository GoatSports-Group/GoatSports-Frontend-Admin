import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseResponse } from '@application/dto/base/base-response';
import { environment } from "@environments/environment";

export interface PresignedUrlResponse {
  uploadUrl: string;
  objectKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageApi {
  private http = inject(HttpClient);
  private httpBackend = inject(HttpBackend);
  private bypassHttp = new HttpClient(this.httpBackend);
  private apiBase = environment.apiUrl;

  getPresignedUrl(fileName: string, contentType: string, folder: string): Observable<BaseResponse<PresignedUrlResponse[]>> {
    const payload = [{ fileName, contentType, folder }];
    return this.http.post<BaseResponse<PresignedUrlResponse[]>>(
      `${this.apiBase}/storage-service/api/v1/files/presigned-url`,
      payload
    );
  }

  /** Nhieu file mot lan; contentLength de storage-service chan anh qua gioi han thu muc (vd. 10 MB cho chat). */
  getPresignedUrls(files: { fileName: string; contentType: string; folder: string; contentLength: number }[]): Observable<BaseResponse<PresignedUrlResponse[]>> {
    return this.http.post<BaseResponse<PresignedUrlResponse[]>>(`${this.apiBase}/storage-service/api/v1/files/presigned-url`, files);
  }

  uploadToPresignedUrl(uploadUrl: string, file: File): Observable<any> {
    return this.bypassHttp.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    });
  }

  getFileUrl(key: string): Observable<string> {
    return this.http.get(`${this.apiBase}/storage-service/api/v1/files`, {
      params: { key },
      responseType: 'text'
    });
  }

}
