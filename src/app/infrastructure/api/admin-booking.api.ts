import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import { OwnerBooking } from '@application/dto/owner-booking/owner-booking.dto';
import {
  AdminBookingCriteria, AdminBookingFilter, ReportExport, ReportExportFormat
} from '@application/ports/persistence/admin-booking.repository';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminBookingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/admin/bookings`;
  private readonly exportsUrl = `${environment.apiUrl}/report-service/api/v1/reports/exports`;

  getBookings(filter: AdminBookingFilter): Observable<BaseResponse<BaseListResponse<OwnerBooking>>> {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.venueId) params = params.set('venueId', filter.venueId);
    if (filter.venueCourtId) params = params.set('venueCourtId', filter.venueCourtId);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.query) params = params.set('query', filter.query);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get<BaseResponse<BaseListResponse<OwnerBooking>>>(this.baseUrl, { params });
  }

  getBooking(bookingId: string): Observable<BaseResponse<OwnerBooking>> {
    return this.http.get<BaseResponse<OwnerBooking>>(`${this.baseUrl}/${bookingId}`);
  }

  requestExport(criteria: AdminBookingCriteria, format: ReportExportFormat,
    labels: { venueName?: string; courtName?: string }): Observable<BaseResponse<ReportExport>> {
    return this.http.post<BaseResponse<ReportExport>>(`${this.exportsUrl}/admin-bookings`, {
      format,
      filter: {
        venueId: criteria.venueId ?? null,
        venueCourtId: criteria.venueCourtId ?? null,
        status: criteria.status ?? null,
        query: criteria.query ?? null,
        fromDate: criteria.fromDate ?? null,
        toDate: criteria.toDate ?? null
      },
      venueName: labels.venueName ?? null,
      courtName: labels.courtName ?? null
    });
  }

  listExports(): Observable<BaseResponse<ReportExport[]>> {
    return this.http.get<BaseResponse<ReportExport[]>>(this.exportsUrl, { params: { type: 'ADMIN_BOOKINGS' } });
  }

  downloadExport(exportId: string): Observable<Blob> {
    return this.http.get(`${this.exportsUrl}/${exportId}/file`, { responseType: 'blob' });
  }
}
