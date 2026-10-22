import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '@domain/entities/notification';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { PageFilter } from '@application/dto/page.filter';
import { buildPageParams } from '@infrastructure/api/build-page-params';
import { environment } from "@environments/environment"

@Injectable({
  providedIn: 'root'
})
export class NotificationApi {
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  getNotifications(filter: PageFilter): Observable<BaseResponse<BaseListResponse<Notification>>> {
    const params = buildPageParams(filter);
    return this.http.get<BaseResponse<BaseListResponse<Notification>>>(
      `${this.apiBase}/notification-service/api/v1/notifications`,
      { params }
    );
  }

  getNotificationsSince(after: string, afterId?: string): Observable<BaseResponse<{ items: Notification[]; hasMore: boolean }>> {
    let params = new HttpParams().set('after', after);
    if (afterId) params = params.set('afterId', afterId);
    return this.http.get<BaseResponse<{ items: Notification[]; hasMore: boolean }>>(
      `${this.apiBase}/notification-service/api/v1/notifications/since`,
      { params }
    );
  }

  getUnreadCount(): Observable<BaseResponse<number>> {
    return this.http.get<BaseResponse<number>>(
      `${this.apiBase}/notification-service/api/v1/notifications/unread-count`
    );
  }

  markAsRead(id: string): Observable<BaseResponse<Notification>> {
    return this.http.put<BaseResponse<Notification>>(
      `${this.apiBase}/notification-service/api/v1/notifications/${id}/read`,
      {}
    );
  }

  markAllRead(): Observable<BaseResponse<void>> {
    return this.http.put<BaseResponse<void>>(
      `${this.apiBase}/notification-service/api/v1/notifications/read-all`,
      {}
    );
  }

  deleteNotification(id: string): Observable<BaseResponse<void>> {
    return this.http.delete<BaseResponse<void>>(
      `${this.apiBase}/notification-service/api/v1/notifications/${id}`
    );
  }
}
