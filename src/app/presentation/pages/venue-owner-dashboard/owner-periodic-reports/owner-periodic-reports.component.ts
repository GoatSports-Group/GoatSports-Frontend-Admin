import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, take } from 'rxjs';
import { GetOwnerRevenueUseCase } from '@application/usecase/owner-revenue/get-owner-revenue.usecase';
import {
  PeriodicReport,
  PeriodicReportFormat,
  PeriodicReportType
} from '@application/dto/owner-revenue/owner-revenue.dto';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { NotifyService } from '@shared/components/notify/notify.service';

type ScheduledType = Exclude<PeriodicReportType, 'CUSTOM'>;

/**
 * Bao cao dinh ky (moi co so cua chu san): report-service tu chot ky tuan / thang / quy / nam vua xong luc 01:30;
 * chu san co the chot ngay ky vua xong va tai PDF / XLSX dung so lieu da chot.
 */
@Component({
  selector: 'app-owner-periodic-reports',
  standalone: true,
  imports: [LucideIconComponent],
  templateUrl: './owner-periodic-reports.component.html',
  styleUrl: './owner-periodic-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerPeriodicReportsComponent implements OnInit {
  private readonly revenue = inject(GetOwnerRevenueUseCase);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly types: readonly { value: ScheduledType; label: string }[] = [
    { value: 'WEEKLY', label: 'Tuần' },
    { value: 'MONTHLY', label: 'Tháng' },
    { value: 'QUARTERLY', label: 'Quý' },
    { value: 'YEARLY', label: 'Năm' }
  ];
  readonly type = signal<ScheduledType>('MONTHLY');
  readonly reports = signal<PeriodicReport[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly generating = signal(false);
  /** Bao cao dang xem truoc: luon xem ban PDF (trinh duyet khong hien duoc XLSX), tai xuong dung dinh dang da bam. */
  readonly preview = signal<{ report: PeriodicReport; format: PeriodicReportFormat } | null>(null);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal(false);
  readonly downloading = signal(false);
  private previewBlob: Blob | null = null;
  private previewObjectUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.releasePreview());
  }

  ngOnInit(): void {
    this.load();
  }

  selectType(type: ScheduledType): void {
    if (this.type() === type) return;
    this.type.set(type);
    this.reports.set([]);
    this.load();
  }

  load(): void {
    const type = this.type();
    this.loading.set(true);
    this.error.set(false);
    this.revenue.listPeriodicReports(type).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: reports => {
        if (this.type() === type) this.reports.set(reports.slice(0, 4));
      },
      error: () => {
        if (this.type() === type) this.error.set(true);
      }
    });
  }

  generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.revenue.generatePeriodicReport(this.type()).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.generating.set(false))
    ).subscribe({
      next: report => {
        this.notify.success(`Đã chốt báo cáo ${this.periodLabel(report).toLowerCase()}.`);
        this.load();
      },
      error: error => this.notify.error(this.errorMessage(error, 'Chưa chốt được báo cáo kỳ vừa xong.'))
    });
  }

  openPreview(report: PeriodicReport, format: PeriodicReportFormat): void {
    this.releasePreview();
    this.preview.set({ report, format });
    this.loadPreview();
  }

  loadPreview(): void {
    const current = this.preview();
    if (!current) return;
    this.previewLoading.set(true);
    this.previewError.set(false);
    this.revenue.exportPeriodicReport(current.report.reportId, 'pdf').pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.previewLoading.set(false))
    ).subscribe({
      next: file => {
        if (this.preview() !== current) return;
        if (!file.size) {
          this.previewError.set(true);
          return;
        }
        this.previewBlob = file;
        this.previewObjectUrl = URL.createObjectURL(file);
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
      },
      error: () => {
        if (this.preview() === current) this.previewError.set(true);
      }
    });
  }

  @HostListener('document:keydown.escape')
  closePreview(): void {
    if (!this.preview() || this.downloading()) return;
    this.releasePreview();
    this.preview.set(null);
  }

  /** PDF: tai dung file dang xem; XLSX: lay file Excel cung snapshot roi moi tai. */
  downloadPreview(): void {
    const current = this.preview();
    if (!current || this.downloading() || this.previewLoading() || this.previewError()) return;
    if (current.format === 'pdf' && this.previewBlob) {
      this.save(this.previewBlob, current.report, 'pdf');
      return;
    }
    this.downloading.set(true);
    this.revenue.exportPeriodicReport(current.report.reportId, current.format).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.downloading.set(false))
    ).subscribe({
      next: file => file.size
        ? this.save(file, current.report, current.format)
        : this.notify.error('Dịch vụ báo cáo không trả dữ liệu.'),
      error: () => this.notify.error(`Không tải được báo cáo ${current.format.toUpperCase()}.`)
    });
  }

  private save(file: Blob, report: PeriodicReport, format: PeriodicReportFormat): void {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bao-cao-${report.periodType.toLowerCase()}-${report.periodStart}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private releasePreview(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
    this.previewBlob = null;
    this.previewUrl.set(null);
    this.previewError.set(false);
  }

  periodLabel(report: PeriodicReport): string {
    const start = new Date(`${report.periodStart}T00:00:00`);
    const day = (value: string) => value.split('-').reverse().slice(0, 2).join('/');
    switch (report.periodType) {
      case 'WEEKLY': return `Tuần ${day(report.periodStart)} – ${day(report.periodEnd)}`;
      case 'MONTHLY': return `Tháng ${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`;
      case 'QUARTERLY': return `Quý ${Math.floor(start.getMonth() / 3) + 1}/${start.getFullYear()}`;
      case 'YEARLY': return `Năm ${start.getFullYear()}`;
      default: return `${day(report.periodStart)} – ${day(report.periodEnd)}`;
    }
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  change(value: number | null): string {
    if (value === null || value === undefined) return 'Chưa có kỳ trước';
    return `${value > 0 ? '+' : ''}${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước`;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string } };
    return candidate?.error?.message || fallback;
  }
}
