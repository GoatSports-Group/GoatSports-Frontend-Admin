import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';
import { FormsModule } from '@angular/forms';
import { PAGE_SIZE } from '@shared/constants/page-size';
import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Observable, Subscription, catchError, finalize, forkJoin, map, of, take } from 'rxjs';
import {
  AppealStatus,
  ContentAppeal,
  ContentReport,
  ModerationActionType,
  ModerationPage,
  ReportStatus,
  ModerationTarget,
  ReportTargetType
} from '@application/dto/moderation/moderation.dto';
import { ActOnReportUseCase } from '@application/usecase/moderation/act-on-report.usecase';
import { GetAppealQueueUseCase } from '@application/usecase/moderation/get-appeal-queue.usecase';
import { GetReportQueueUseCase } from '@application/usecase/moderation/get-report-queue.usecase';
import { ReviewAppealUseCase } from '@application/usecase/moderation/review-appeal.usecase';
import { GetModerationTargetUseCase } from '@application/usecase/moderation/get-moderation-target.usecase';
import { UserDirectoryService } from '@presentation/services/user-directory.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { aiVerdictLabel, aiVerdictTone } from '@shared/utils/ai-verdict';
import { GetStorageFileUrlUseCase } from '@application/usecase/storage/get-storage-file-url.usecase';
import { SPORT_LABEL } from '@presentation/pages/community-analytics/community-analytics.utils';

type Lane = 'REPORTS' | 'APPEALS';

interface ActionChoice {
  readonly value: ModerationActionType;
  readonly label: string;
  readonly hint: string;
}

const PAGE_SIZE_TABLE = PAGE_SIZE.table;
/** Báo cáo đã đóng vẫn đổi được trạng thái nội dung (ẩn ↔ gỡ ↔ khôi phục). */
const STATUS_ACTIONS: readonly ModerationActionType[] = ['HIDE_CONTENT', 'REMOVE_CONTENT', 'RESTORE_CONTENT'];
const STATUS_OF: Partial<Record<ModerationActionType, string>> = {
  HIDE_CONTENT: 'HIDDEN', REMOVE_CONTENT: 'REMOVED', RESTORE_CONTENT: 'PUBLISHED'
};
const MIN_REASON = 10;

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, LucideIconComponent, PageLoadingComponent, PaginationComponent, SelectComponent, FormsModule],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationComponent {
  readonly pageSize = PAGE_SIZE_TABLE;
  private readonly getReports = inject(GetReportQueueUseCase);
  private readonly actOnReport = inject(ActOnReportUseCase);
  private readonly getAppeals = inject(GetAppealQueueUseCase);
  private readonly reviewAppealUseCase = inject(ReviewAppealUseCase);
  private readonly destroyRef = inject(DestroyRef);
  private readonly getTarget = inject(GetModerationTargetUseCase);
  private readonly getFileUrl = inject(GetStorageFileUrlUseCase);
  /** URL đọc ảnh / tệp của nội dung đang xem (theo storageKey). */
  readonly mediaUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly users = inject(UserDirectoryService);
  readonly aiLabel = aiVerdictLabel;
  readonly aiTone = aiVerdictTone;
  private targetRequest?: Subscription;

  readonly actionChoices: readonly ActionChoice[] = [
    { value: 'HIDE_CONTENT', label: 'Ẩn nội dung', hint: 'Nội dung biến mất khỏi bảng tin. Tác giả được báo ngay và có thể khiếu nại.' },
    { value: 'REMOVE_CONTENT', label: 'Gỡ nội dung', hint: 'Gỡ hẳn khỏi hệ thống. Tác giả được báo ngay và có thể khiếu nại.' },
    { value: 'RESTORE_CONTENT', label: 'Khôi phục', hint: 'Đưa nội dung đã ẩn hoặc gỡ trở lại bảng tin. Tác giả được báo.' },
    { value: 'WARNING', label: 'Cảnh cáo', hint: 'Giữ nguyên nội dung. Tác giả được báo ngay và có thể khiếu nại.' },
    { value: 'DISMISS_REPORT', label: 'Bác báo cáo', hint: 'Báo cáo không có cơ sở, nội dung giữ nguyên.' }
  ];

  readonly reportStatuses: readonly ReportStatus[] = ['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'];
  readonly appealStatuses: readonly AppealStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
  readonly reportStatusOptions: readonly SelectOption[] = [
    { value: '', label: 'Chờ xử lý và đang xem xét' },
    ...this.reportStatuses.map(status => ({ value: status, label: this.statusLabel(status) }))
  ];
  readonly appealStatusOptions: readonly SelectOption[] = this.appealStatuses.map(status => ({ value: status, label: this.statusLabel(status) }));

  readonly lane = signal<Lane>('REPORTS');
  readonly reports = signal<ContentReport[]>([]);
  readonly appeals = signal<ContentAppeal[]>([]);
  readonly reportStatusFilter = signal<string>('');
  readonly appealStatusFilter = signal<string>('PENDING');
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pages = signal(0);
  readonly loading = signal(false);
  /** Doi trang: giu trang hien tai (lam mo) thay vi skeleton. */
  readonly paging = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  /** Popup chi tiết (bấm vào thẻ): đọc đầy đủ lý do, người gửi và nội dung bị báo cáo trước khi xử lý. */
  readonly detailReport = signal<ContentReport | null>(null);
  readonly detailAppeal = signal<ContentAppeal | null>(null);
  readonly target = signal<ModerationTarget | null>(null);
  readonly targetLoading = signal(false);
  readonly targetError = signal<string | null>(null);

  readonly openReportId = signal<string | null>(null);
  readonly openReport = computed(() => this.reports().find(report => report.reportId === this.openReportId()) ?? null);
  readonly openAppealId = signal<string | null>(null);
  readonly openAppeal = computed(() => this.appeals().find(appeal => appeal.appealId === this.openAppealId()) ?? null);
  readonly draftAction = signal<ModerationActionType>('HIDE_CONTENT');
  /** Popup xử lý của báo cáo đã đóng: chỉ đổi trạng thái nội dung. */
  readonly changingStatus = computed(() => {
    const report = this.openReport();
    return !!report && !this.isOpen(report);
  });
  /** Lựa chọn trong popup: báo cáo mở thì mọi hành động; đã đóng thì trạng thái khác trạng thái hiện tại. */
  readonly dialogChoices = computed<readonly ActionChoice[]>(() => {
    if (!this.changingStatus()) return this.actionChoices;
    const current = this.target()?.status;
    return this.actionChoices.filter(choice => STATUS_ACTIONS.includes(choice.value) && STATUS_OF[choice.value] !== current);
  });
  readonly draftReason = signal('');

  readonly reasonTooShort = computed(() => this.draftReason().trim().length < MIN_REASON);
  readonly activeHint = computed(
    () => this.actionChoices.find(choice => choice.value === this.draftAction())?.hint ?? ''
  );
  readonly canSubmit = computed(() => !this.reasonTooShort()
    && this.dialogChoices().some(choice => choice.value === this.draftAction())
    && (!this.changingStatus() || (!this.targetLoading() && !!this.target()?.found)));

  constructor() { this.load(0); }

  switchLane(lane: Lane): void {
    if (this.lane() === lane || this.loading()) return;
    this.lane.set(lane);
    this.openReportId.set(null);
    this.openAppealId.set(null);
    this.notice.set(null);
    this.load(0);
  }

  selectReportStatus(value: string): void {
    this.reportStatusFilter.set(value);
    this.load(0);
  }

  selectAppealStatus(value: string): void {
    this.appealStatusFilter.set(value);
    this.load(0);
  }

  load(page = 0, keepCurrent = false): void {
    if (this.loading() || this.paging()) return;
    (keepCurrent ? this.paging : this.loading).set(true);
    this.error.set(null);

    const filter = {
      status: this.currentStatusFilter(),
      page,
      size: PAGE_SIZE_TABLE
    };
    const request$: Observable<ModerationPage<ContentReport | ContentAppeal>> =
      this.lane() === 'REPORTS'
        ? this.getReports.execute(filter)
        : this.getAppeals.execute(filter);

    request$.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loading.set(false); this.paging.set(false); })
    ).subscribe({
      next: result => {
        if (keepCurrent) queueMicrotask(() => this.scrollListIntoView());
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
    this.load(next, true);
  }

  toggleReport(reportId: string): void {
    const next = this.openReportId() === reportId ? null : reportId;
    this.openReportId.set(next);
    if (next) {
      this.draftAction.set('HIDE_CONTENT');
      this.draftReason.set('');
      // Đổi trạng thái cần biết trạng thái hiện tại của nội dung để bỏ lựa chọn trùng.
      const report = this.openReport();
      if (report && !this.isOpen(report)) this.loadTarget(report.targetType, report.targetId);
    }
  }

  isOpen(report: ContentReport): boolean {
    return report.status === 'PENDING' || report.status === 'REVIEWING';
  }

  /** Báo cáo đã đóng về bài viết / bình luận: vẫn đổi được trạng thái nội dung. */
  canChangeStatus(report: ContentReport): boolean {
    return !this.isOpen(report) && (report.targetType === 'POST' || report.targetType === 'COMMENT');
  }

  openReportDetail(report: ContentReport): void {
    this.detailAppeal.set(null);
    this.detailReport.set(report);
    this.users.resolve([report.reporterId, ...report.actions.map(action => action.moderatorId)]);
    this.loadTarget(report.targetType, report.targetId);
  }

  openAppealDetail(appeal: ContentAppeal): void {
    this.detailReport.set(null);
    this.detailAppeal.set(appeal);
    this.users.resolve([appeal.appellantId, appeal.reviewedBy]);
    this.loadTarget(appeal.targetType, appeal.targetId);
  }

  closeDetail(): void {
    this.targetRequest?.unsubscribe();
    this.detailReport.set(null);
    this.detailAppeal.set(null);
    this.target.set(null);
  }

  /** Từ popup chi tiết của báo cáo đã đóng sang popup đổi trạng thái (giữ nội dung đã tải). */
  changeStatusFromDetail(): void {
    const report = this.detailReport();
    if (!report) return;
    this.detailReport.set(null);
    this.toggleReport(report.reportId);
  }

  /** Từ popup chi tiết sang popup xử lý của cùng mục. */
  handleFromDetail(): void {
    const report = this.detailReport();
    const appeal = this.detailAppeal();
    this.closeDetail();
    if (report) this.toggleReport(report.reportId);
    if (appeal) this.openAppealId.set(appeal.appealId);
  }

  loadTarget(type: ReportTargetType | null, id: string | null): void {
    this.targetRequest?.unsubscribe();
    this.target.set(null);
    this.targetError.set(null);
    if (!type || !id) return;
    this.targetLoading.set(true);
    this.targetRequest = this.getTarget.execute(type, id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.targetLoading.set(false))
    ).subscribe({
      next: target => {
        this.target.set(target);
        this.users.resolve([target.authorId, target.shared?.authorId ?? null]);
        this.loadMedia(target);
        // Popup đổi trạng thái: chọn sẵn "Khôi phục" nếu được (hay dùng nhất), không thì lựa chọn hợp lệ đầu tiên.
        if (this.changingStatus()) {
          const choices = this.dialogChoices();
          this.draftAction.set((choices.find(choice => choice.value === 'RESTORE_CONTENT') ?? choices[0])?.value ?? 'HIDE_CONTENT');
        }
      },
      error: error => this.targetError.set(error?.error?.message ?? 'Không tải được nội dung bị báo cáo.')
    });
  }

  private loadMedia(target: ModerationTarget): void {
    const keys = [...(target.attachments ?? []), ...(target.shared?.attachments ?? [])]
      .map(item => item.storageKey)
      .filter(key => !!key && !this.mediaUrls().has(key));
    if (!keys.length) return;
    forkJoin(keys.map(key => this.getFileUrl.execute(key).pipe(
      map(url => [key, url] as const),
      catchError(() => of([key, ''] as const))
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(pairs => this.mediaUrls.update(current => {
      const next = new Map(current);
      pairs.forEach(([key, url]) => next.set(key, url));
      return next;
    }));
  }

  mediaUrl(storageKey: string): string {
    return this.mediaUrls().get(storageKey) ?? '';
  }

  fileName(storageKey: string): string {
    return storageKey.split('/').pop() || 'Tệp đính kèm';
  }

  sportLabel(sport: string | null | undefined): string {
    return sport ? SPORT_LABEL[sport] ?? sport : '';
  }

  /** "Đội A 3 – 1 Đội B" (chưa có tỉ số thì "Đội A – Đội B"). */
  sidesText(sides: { name: string; score: number | null }[] | null | undefined): string {
    if (!sides?.length) return '';
    return sides.map(side => side.score == null ? side.name : `${side.name} ${side.score}`).join(' – ');
  }

  statsText(stats: { label: string; value: string }[] | null | undefined): string {
    return (stats ?? []).map(stat => `${stat.label}: ${stat.value}`).join(' · ');
  }

  /** Nội dung không có chữ nhưng có phần khác để xem (ảnh, khoe trận, kèo, bài chia sẻ). */
  hasRichContent(target: ModerationTarget): boolean {
    return !!(target.attachments?.length || target.highlight || target.playerCall || target.shared);
  }

  /** Tên kèm email; chưa tra xong thì mã rút gọn. */
  who(id: string | null | undefined): string {
    if (!id) return '—';
    return this.users.name(id) || this.shortId(id);
  }

  contentStatus(status: string | null): string {
    switch (status) {
      case 'PUBLISHED': case 'SENT': case 'DELIVERED': case 'READ': return 'Đang hiển thị';
      case 'HIDDEN': return 'Đã ẩn';
      case 'REMOVED': case 'DELETED': return 'Đã gỡ / xóa';
      case 'DRAFT': return 'Bản nháp';
      default: return status ?? '—';
    }
  }

  /** Đóng popup xử lý; đang gửi thì giữ lại để không mất phản hồi lỗi. */
  closeDialog(): void {
    if (this.submitting()) return;
    if (this.changingStatus()) {
      this.targetRequest?.unsubscribe();
      this.target.set(null);
    }
    this.openReportId.set(null);
    this.openAppealId.set(null);
  }

  selectAction(value: ModerationActionType): void {
    this.draftAction.set(value);
  }

  updateReason(event: Event): void {
    this.draftReason.set((event.target as HTMLTextAreaElement).value);
  }

  submitAction(reportId: string): void {
    if (this.submitting() || !this.canSubmit()) return;
    const changingStatus = this.changingStatus();
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
        this.notice.set(changingStatus ? 'Đã đổi trạng thái nội dung và báo cho tác giả.' : 'Đã xử lý báo cáo.');
        this.openReportId.set(null);
        this.target.set(null);
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
        this.openAppealId.set(null);
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

  /** Doi trang xong: dua dau danh sach vao tam nhin neu no da troi len tren. */
  private scrollListIntoView(): void {
    const element = document.querySelector<HTMLElement>('[data-list-top]');
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
