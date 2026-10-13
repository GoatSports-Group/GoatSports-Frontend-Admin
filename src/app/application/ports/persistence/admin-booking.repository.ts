import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerBooking, OwnerBookingPage, OwnerBookingStatus } from '@application/dto/owner-booking/owner-booking.dto';
import { ReportExport, ReportExportFormat } from '@application/ports/persistence/report-export.repository';

/** Bộ lọc đơn đặt sân toàn nền tảng (admin). `query` tìm theo mã đơn, tên/số điện thoại khách tại quầy, tên cơ sở. */
export interface AdminBookingFilter {
  venueId?: string;
  venueCourtId?: string;
  status?: OwnerBookingStatus;
  query?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  size: number;
}

/** Bộ lọc không kèm phân trang (xuất báo cáo lấy mọi trang). */
export type AdminBookingCriteria = Omit<AdminBookingFilter, 'page' | 'size'>;

export interface AdminBookingRepository {
  getBookings(filter: AdminBookingFilter): Observable<OwnerBookingPage>;
  getBooking(bookingId: string): Observable<OwnerBooking>;
  /**
   * Tạo job xuất ở nền và trả về ngay (Excel = danh sách từng đơn; PDF = báo cáo tổng hợp); `labels` chỉ để ghi phạm
   * vi (tên cơ sở / sân) lên báo cáo. Danh sách / tải báo cáo đã xuất: REPORT_EXPORT_REPOSITORY_TOKEN.
   */
  requestExport(criteria: AdminBookingCriteria, format: ReportExportFormat,
    labels: { venueName?: string; courtName?: string }): Observable<ReportExport>;
}

export const ADMIN_BOOKING_REPOSITORY_TOKEN = new InjectionToken<AdminBookingRepository>(
  'ADMIN_BOOKING_REPOSITORY_TOKEN'
);
