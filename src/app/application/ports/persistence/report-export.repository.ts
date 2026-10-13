import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type ReportExportFormat = 'xlsx' | 'pdf';
export type ReportExportStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** Một lần xuất báo cáo chạy nền (report-service, dựng bằng Jasper), giữ 7 ngày. */
export interface ReportExport {
  exportId: string;
  /** ADMIN_BOOKINGS, FINANCE_REFUNDS, FINANCE_PAYOUTS. */
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

/**
 * Báo cáo đã xuất của người đang đăng nhập (mọi loại dùng chung). Mỗi trang tự gửi yêu cầu xuất qua repository của
 * nó (đơn đặt sân, tài chính), còn xem danh sách / tải file thì qua đây.
 */
export interface ReportExportRepository {
  list(types: readonly string[]): Observable<ReportExport[]>;
  download(exportId: string): Observable<Blob>;
}

export const REPORT_EXPORT_REPOSITORY_TOKEN = new InjectionToken<ReportExportRepository>('REPORT_EXPORT_REPOSITORY_TOKEN');
