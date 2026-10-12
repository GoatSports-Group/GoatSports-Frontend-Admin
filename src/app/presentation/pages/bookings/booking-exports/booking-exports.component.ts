import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription, finalize, timer } from 'rxjs';
import {
  ADMIN_BOOKING_REPOSITORY_TOKEN, AdminBookingCriteria, ReportExport, ReportExportFormat, ReportExportStatus
} from '@application/ports/persistence/admin-booking.repository';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { NotifyService } from '@shared/components/notify/notify.service';
import { blobErrorMessage, downloadBlob } from '@shared/utils/file.utils';

const POLL_MS = 3_000;
const MAX_ROWS = 10_000;

const STATUS_META: Record<ReportExportStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Đang chờ', tone: 'neutral' },
  RUNNING: { label: 'Đang tạo', tone: 'info' },
  DONE: { label: 'Sẵn sàng', tone: 'success' },
  FAILED: { label: 'Lỗi', tone: 'danger' }
};

export const EXPORT_FORMATS: readonly { value: ReportExportFormat; label: string; hint: string; icon: string }[] = [
  { value: 'xlsx', label: 'Excel · danh sách đơn', hint: 'Mọi đơn khớp bộ lọc, mỗi đơn một dòng; lọc và tính toán tiếp được.', icon: 'file-spreadsheet' },
  { value: 'pdf', label: 'PDF · báo cáo tổng hợp', hint: 'Tổng đơn, giá trị, đã thu, tỉ lệ không thành; theo trạng thái, cơ sở, nguồn đặt. Để in hoặc gửi.', icon: 'file-text' }
];

/**
 * Xuất báo cáo đơn đặt sân chạy nền: popup xác nhận phạm vi + định dạng, rồi report-service dựng file ở nền.
 * Người dùng làm việc tiếp; khi xong có thông báo ở chuông, file nằm trong "Báo cáo đã xuất" (giữ 7 ngày).
 * Trong lúc còn job đang chạy và trang đang mở, danh sách tự hỏi lại mỗi 3 giây.
 */
@Component({
  selector: 'app-booking-exports',
  templateUrl: './booking-exports.component.html',
  styleUrls: ['./booking-exports.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, LucideIconComponent]
})
export class BookingExportsComponent implements OnInit {
  private readonly repository = inject(ADMIN_BOOKING_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private poll?: Subscription;

  /** Bộ lọc đang áp dụng trên danh sách (xuất mọi trang của nó). */
  readonly criteria = input.required<AdminBookingCriteria>();
  /** Số đơn khớp bộ lọc. */
  readonly total = input(0);
  /** Mô tả phạm vi để người dùng xác nhận (vd "Hoàn tất", "Goat Arena · Sân 1", "01/10 – 12/10"). */
  readonly scope = input<readonly string[]>([]);
  readonly labels = input<{ venueName?: string; courtName?: string }>({});

  readonly formats = EXPORT_FORMATS;
  readonly maxRows = MAX_ROWS;
  readonly dialogOpen = signal(false);
  readonly format = signal<ReportExportFormat>('xlsx');
  readonly requesting = signal(false);
  readonly requestError = signal<string | null>(null);

  readonly panelOpen = signal(false);
  readonly exports = signal<ReportExport[]>([]);
  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);
  readonly downloadingId = signal<string | null>(null);
  readonly activeCount = computed(() => this.exports().filter(isActive).length);
  readonly tooMany = computed(() => this.total() > MAX_ROWS);

  ngOnInit(): void {
    // Bấm thông báo "Báo cáo đã sẵn sàng" → /admin/bookings?exports=open (kể cả khi đang ở trang này).
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => { if (params.get('exports') === 'open') this.openPanel(); });
    this.refresh();
  }

  openDialog(): void {
    this.requestError.set(null);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (!this.requesting()) this.dialogOpen.set(false);
  }

  submit(): void {
    if (this.requesting() || this.tooMany() || !this.total()) return;
    this.requesting.set(true);
    this.requestError.set(null);
    this.repository.requestExport(this.criteria(), this.format(), this.labels())
      .pipe(finalize(() => this.requesting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: job => {
          this.dialogOpen.set(false);
          this.exports.update(list => [job, ...list.filter(item => item.exportId !== job.exportId)]);
          this.panelOpen.set(true);
          this.schedulePoll();
          if (!isActive(job)) return;
          this.notify.info('Báo cáo đang được tạo ở nền. Bạn có thể làm việc tiếp, sẽ có thông báo khi xong.');
        },
        error: err => this.requestError.set(err?.error?.message ?? 'Chưa tạo được yêu cầu xuất báo cáo. Vui lòng thử lại.')
      });
  }

  openPanel(): void {
    this.panelOpen.set(true);
    this.refresh();
  }

  closePanel(): void { this.panelOpen.set(false); }

  refresh(): void {
    this.listLoading.set(true);
    this.repository.listExports()
      .pipe(finalize(() => this.listLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.listError.set(null); this.apply(list); },
        error: err => {
          this.listError.set(err?.error?.message ?? 'Không tải được danh sách báo cáo.');
          this.schedulePoll();
        }
      });
  }

  download(job: ReportExport): void {
    if (job.status !== 'DONE' || this.downloadingId()) return;
    this.downloadingId.set(job.exportId);
    this.repository.downloadExport(job.exportId)
      .pipe(finalize(() => this.downloadingId.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: file => downloadBlob(file, job.fileName ?? `bao-cao.${job.format}`),
        error: err => blobErrorMessage(err).then(message => this.notify.error(message ?? 'Không tải được file báo cáo.'))
      });
  }

  /**
   * Xem PDF ở tab mới. File cần token nên phải tải qua HttpClient rồi mở bằng blob URL; tab được mở ngay trong
   * cú bấm (trình duyệt chặn window.open gọi sau khi chờ mạng), rồi mới gán địa chỉ khi tải xong.
   */
  preview(job: ReportExport): void {
    if (job.status !== 'DONE' || job.format !== 'pdf') return;
    const tab = window.open('', '_blank');
    if (!tab) { this.notify.error('Trình duyệt đang chặn mở tab mới. Hãy cho phép cửa sổ bật lên rồi thử lại.'); return; }
    tab.document.title = job.fileName ?? 'Báo cáo';
    tab.document.body.textContent = 'Đang tải báo cáo...';
    this.repository.downloadExport(job.exportId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: file => {
          const url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
          tab.location.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
        error: err => {
          tab.close();
          blobErrorMessage(err).then(message => this.notify.error(message ?? 'Không mở được báo cáo.'));
        }
      });
  }

  statusMeta(status: ReportExportStatus) { return STATUS_META[status]; }

  formatMeta(format: ReportExportFormat) { return EXPORT_FORMATS.find(item => item.value === format) ?? EXPORT_FORMATS[0]; }

  size(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  }

  daysLeft(expiresAt: string): number {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  }

  /** Cập nhật danh sách; job vừa chuyển từ đang chạy sang xong / lỗi thì báo ngay trên trang. */
  private apply(list: ReportExport[]): void {
    const before = new Map(this.exports().map(item => [item.exportId, item.status]));
    for (const job of list) {
      const previous = before.get(job.exportId);
      if (!previous || !isActive({ status: previous })) continue;
      if (job.status === 'DONE') this.notify.success(`${this.formatMeta(job.format).label} đã sẵn sàng để tải.`, 'Báo cáo đã xong');
      if (job.status === 'FAILED') this.notify.error(job.failureReason ?? 'Không tạo được báo cáo.', 'Báo cáo bị lỗi');
    }
    this.exports.set(list);
    this.schedulePoll();
  }

  private schedulePoll(): void {
    this.poll?.unsubscribe();
    if (!this.exports().some(isActive)) return;
    this.poll = timer(POLL_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
  }
}

function isActive(job: { status: ReportExportStatus }): boolean {
  return job.status === 'PENDING' || job.status === 'RUNNING';
}
