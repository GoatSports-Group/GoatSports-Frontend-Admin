import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Observable, finalize, take } from 'rxjs';
import {
  AppealStatus,
  ContentAppeal,
  ContentReport,
  ModerationActionType,
  ModerationPage,
  ReportStatus
} from '@application/dto/moderation/moderation.dto';
import { ActOnReportUseCase } from '@application/usecase/moderation/act-on-report.usecase';
import { GetAppealQueueUseCase } from '@application/usecase/moderation/get-appeal-queue.usecase';
import { GetReportQueueUseCase } from '@application/usecase/moderation/get-report-queue.usecase';
import { ReviewAppealUseCase } from '@application/usecase/moderation/review-appeal.usecase';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';

type Lane = 'REPORTS' | 'APPEALS';

interface ActionChoice {
  readonly value: ModerationActionType;
  readonly label: string;
  readonly hint: string;
}

const PAGE_SIZE = 20;
const MIN_REASON = 10;

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [DatePipe, LucideIconComponent, PageLoadingComponent],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationComponent {
  private readonly getReports = inject(GetReportQueueUseCase);
  private readonly actOnReport = inject(ActOnReportUseCase);
  private readonly getAppeals = inject(GetAppealQueueUseCase);
  private readonly reviewAppealUseCase = inject(ReviewAppealUseCase);
  private readonly destroyRef = inject(DestroyRef);

  readonly actionChoices: readonly ActionChoice[] = [
    { value: 'HIDE_CONTENT', label: 'Ẩn nội dung', hint: 'Nội dung biến mất khỏi bảng tin, tác giả có thể khiếu nại.' },
    { value: 'REMOVE_CONTENT', label: 'Gỡ nội dung', hint: 'Gỡ hẳn khỏi hệ thống, tác giả có thể khiếu nại.' },
    { value: 'RESTORE_CONTENT', label: 'Khôi phục', hint: 'Đưa nội dung đã ẩn hoặc gỡ trở lại bảng tin.' },
    { value: 'WARNING', label: 'Cảnh cáo', hint: 'Ghi nhận vi phạm nhưng giữ nguyên nội dung.' },
    { value: 'DISMISS_REPORT', label: 'Bác báo cáo', hint: 'Báo cáo không có cơ sở, nội dung giữ nguyên.' }
  ];

  readonly reportStatuses: readonly ReportStatus[] = ['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'];
  readonly appealStatuses: readonly AppealStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

  readonly lane = signal<Lane>('REPORTS');
  readonly reports = signal<ContentReport[]>([]);
  readonly appeals = signal<ContentAppeal[]>([]);
  readonly reportStatusFilter = signal<string>('');
  readonly appealStatusFilter = signal<string>('PENDING');
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pages = signal(0);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly openReportId = signal<string | null>(null);
  readonly draftAction = signal<ModerationActionType>('HIDE_CONTENT');
  readonly draftReason = signal('');

  readonly reasonTooShort = computed(() => this.draftReason().trim().length < MIN_REASON);
  readonly activeHint = computed(
    () => this.actionChoices.find(choice => choice.value === this.draftAction())?.hint ?? ''
  );

  constructor() { this.load(0); }

  switchLane(lane: Lane): void {
    if (this.lane() === lane || this.loading()) return;
    this.lane.set(lane);
    this.openReportId.set(null);
    this.notice.set(null);
    this.load(0);
  }

  selectReportStatus(event: Event): void {
    this.reportStatusFilter.set((event.target as HTMLSelectElement).value);
    this.load(0);
  }

  selectAppealStatus(event: Event): void {
    this.appealStatusFilter.set((event.target as HTMLSelectElement).value);
    this.load(0);
  }

  load(page = 0): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    const filter = {
      status: this.currentStatusFilter(),
      page,
      size: PAGE_SIZE
    };
    const request$: Observable<ModerationPage<ContentReport | ContentAppeal>> =
      this.lane() === 'REPORTS'
        ? this.getReports.execute(filter)
        : this.getAppeals.execute(filter);

    request$.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => {
        if (this.lane() === 'REPORTS') {
          this.reports.set(result.items as ContentReport[]);
          this.appeals.set([]);
        } else {
          this.appeals.set(result.items as ContentAppeal[]);
          this.reports.set([]);
        }
        this.total.set(result.total);
        this.page.set(result.page);
        this.pages.set(result.pages);
      },
      error: error => this.fail(error)
    });
  }

  retry(): void { this.load(this.page()); }

  goToPage(next: number): void {
    if (next < 0 || next >= this.pages() || next === this.page()) return;
    this.openReportId.set(null);
    this.load(next);
  }

  toggleReport(reportId: string): void {
    const next = this.openReportId() === reportId ? null : reportId;
    this.openReportId.set(next);
    if (next) {
      this.draftAction.set('HIDE_CONTENT');
      this.draftReason.set('');
    }
  }

  selectAction(event: Event): void {
    this.draftAction.set((event.target as HTMLSelectElement).value as ModerationActionType);
  }

  updateReason(event: Event): void {
    this.draftReason.set((event.target as HTMLTextAreaElement).value);
  }

  submitAction(reportId: string): void {
    if (this.submitting() || this.reasonTooShort()) return;
    this.submitting.set(true);
    this.notice.set(null);
    this.error.set(null);

    this.actOnReport.execute({
      reportId,
      actionType: this.draftAction(),
      reason: this.draftReason().trim()
    }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.submitting.set(false))
    ).subscribe({
      next: () => {
        this.notice.set('Đã xử lý báo cáo.');
        this.openReportId.set(null);
        this.load(this.page());
      },
      error: error => this.fail(error)
    });
  }

  reviewAppeal(appealId: string, decision: Exclude<AppealStatus, 'PENDING'>): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.notice.set(null);
    this.error.set(null);

    this.reviewAppealUseCase.execute({ appealId, decision }).pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.submitting.set(false))
    ).subscribe({
      next: () => {
        this.notice.set(decision === 'APPROVED'
          ? 'Đã chấp nhận khiếu nại và khôi phục nội dung.'
          : 'Đã từ chối khiếu nại.');
        this.load(this.page());
      },
      error: error => this.fail(error)
    });
  }

  statusLabel(status: ReportStatus | AppealStatus): string {
    switch (status) {
      case 'PENDING': return 'Chờ xử lý';
      case 'REVIEWING': return 'Đang xem xét';
      case 'RESOLVED': return 'Đã xử lý';
      case 'APPROVED': return 'Đã chấp nhận';
      case 'REJECTED': return 'Đã từ chối';
      default: return status;
    }
  }

  actionLabel(actionType: ModerationActionType | null): string {
    if (!actionType) return 'Không rõ';
    return this.actionChoices.find(choice => choice.value === actionType)?.label
      ?? (actionType === 'SUSPEND_USER' ? 'Đình chỉ tài khoản' : 'Đình chỉ sân');
  }

  targetLabel(targetType: string | null): string {
    if (targetType === 'POST') return 'Bài viết';
    if (targetType === 'COMMENT') return 'Bình luận';
    if (targetType === 'USER') return 'Người dùng';
    if (targetType === 'VENUE') return 'Cơ sở';
    return 'Không rõ';
  }

  shortId(value: string | null): string {
    return value ? value.slice(0, 8) : '—';
  }

  private currentStatusFilter(): string[] {
    const value = this.lane() === 'REPORTS' ? this.reportStatusFilter() : this.appealStatusFilter();
    return value ? [value] : [];
  }

  private fail(error: unknown): void {
    const message = (error as { error?: { message?: string } })?.error?.message;
    this.error.set(typeof message === 'string' && message
      ? message
      : 'Không thể kết nối tới dịch vụ kiểm duyệt. Vui lòng thử lại.');
  }
}
