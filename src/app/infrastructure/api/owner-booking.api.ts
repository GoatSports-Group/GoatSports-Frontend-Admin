import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseListResponse, BaseResponse } from '@application/dto/base/base-response';
import {
  OwnerBooking,
  OwnerBookingFilter,
  OwnerBookingStatus,
  CreateOwnerWalkInBooking,
  OwnerBookingPaymentMethod,
  OwnerBookingPaymentResult,
  OwnerBookingReportFilter
} from '@application/dto/owner-booking/owner-booking.dto';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class OwnerBookingApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venue-service/api/v1/owner/bookings`;
  private readonly reportBaseUrl = `${environment.apiUrl}/report-service/api/v1/reports`;

  getBookings(filter: OwnerBookingFilter): Observable<BaseResponse<BaseListResponse<OwnerBooking>>> {
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

  updateStatus(
    bookingId: string, status: OwnerBookingStatus
  ): Observable<BaseResponse<OwnerBooking>> {
    return this.http.patch<BaseResponse<OwnerBooking>>(
      `${this.baseUrl}/${bookingId}/status`, { status }
    );
  }

  createWalkIn(request: CreateOwnerWalkInBooking): Observable<BaseResponse<{ booking: OwnerBooking }>> {
    const url = `${environment.apiUrl}/venue-service/api/v1/owner/check-ins/walk-ins`;
    return this.http.post<BaseResponse<{ booking: OwnerBooking }>>(url, request);
  }

  createPayment(
    bookingId: string, method: OwnerBookingPaymentMethod
  ): Observable<BaseResponse<OwnerBookingPaymentResult>> {
    return this.http.post<BaseResponse<OwnerBookingPaymentResult>>(
      `${this.baseUrl}/${bookingId}/payments`, { method }
    );
  }

  exportReport(filter: OwnerBookingReportFilter): Observable<Blob> {
    const params = this.reportParams(filter).set('format', 'xlsx');
    return this.http.get(`${this.reportBaseUrl}/export/owner-bookings`, { params, responseType: 'blob' });
  }

  previewReport(filter: OwnerBookingReportFilter): Observable<Blob> {
    return this.http.get(`${this.reportBaseUrl}/preview/owner-bookings`, {
      params: this.reportParams(filter),
      responseType: 'blob'
    });
  }

  private reportParams(filter: OwnerBookingReportFilter): HttpParams {
    let params = new HttpParams();
    if (filter.venueId) params = params.set('venueId', filter.venueId);
    if (filter.venueCourtId) params = params.set('venueCourtId', filter.venueCourtId);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.paymentStatus) params = params.set('paymentStatus', filter.paymentStatus);
    if (filter.query) params = params.set('query', filter.query);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return params;
  }

}
