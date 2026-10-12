import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerBooking, OwnerBookingPage, OwnerBookingStatus } from '@application/dto/owner-booking/owner-booking.dto';

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

/** Excel = danh sách từng đơn; PDF = báo cáo tổng hợp (chỉ số, theo trạng thái / cơ sở / nguồn đặt). */
export type ReportExportFormat = 'xlsx' | 'pdf';
export type ReportExportStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** Một lần xuất báo cáo chạy nền (report-service), giữ 7 ngày. */
export interface ReportExport {
  exportId: string;
  reportType: string;
  format: ReportExportFormat;
  status: ReportExportStatus;
  filterSummary: string;
  rowCount: number | null;
  fileName: string | null;
  fileSize: number | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
}

export interface AdminBookingRepository {
  getBookings(filter: AdminBookingFilter): Observable<OwnerBookingPage>;
  getBooking(bookingId: string): Observable<OwnerBooking>;
  /** Tạo job xuất ở nền và trả về ngay; `labels` chỉ để ghi phạm vi (tên cơ sở / sân) lên báo cáo. */
  requestExport(criteria: AdminBookingCriteria, format: ReportExportFormat,
    labels: { venueName?: string; courtName?: string }): Observable<ReportExport>;
  /** Báo cáo gần đây của chính người dùng, mới nhất trước. */
  listExports(): Observable<ReportExport[]>;
  downloadExport(exportId: string): Observable<Blob>;
}

export const ADMIN_BOOKING_REPOSITORY_TOKEN = new InjectionToken<AdminBookingRepository>(
  'ADMIN_BOOKING_REPOSITORY_TOKEN'
);
