import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, finalize } from 'rxjs';
import {
  AssistantFaq,
  KnowledgeGap,
  KnowledgeGapReason,
  KnowledgeGapStatus
} from '@application/dto/assistant-knowledge/assistant-knowledge.dto';
import { ASSISTANT_KNOWLEDGE_REPOSITORY_TOKEN } from '@application/ports/persistence/assistant-knowledge.repository';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';

export type KnowledgeTab = 'OPEN' | 'FAQ' | 'DISMISSED';

export const REASON_LABEL: Record<KnowledgeGapReason, string> = {
  no_documents_no_tools: 'Không có tài liệu phù hợp',
  refused: 'Trợ lý nói chưa có thông tin',
  llm_unavailable: 'LLM không dùng được',
  not_helpful: 'Người dùng báo chưa hữu ích'
};

const QUESTION_MAX = 500;
const ANSWER_MIN = 10;
const ANSWER_MAX = 4000;

/**
 * Vòng bổ sung kiến thức cho trợ lý GOAT AI: câu trợ lý chưa trả lời được (gộp câu gần như trùng, hỏi nhiều nhất
 * trước) → admin trả lời → ai-service lưu thành tài liệu FAQ và trợ lý dùng ngay. Câu cần dữ liệu thật hay tính năng
 * mới (vd. "sân nào trống") thì bỏ qua và báo đội phát triển, không trả lời bằng văn bản cố định.
 */
@Component({
  selector: 'app-assistant-knowledge',
  templateUrl: './assistant-knowledge.component.html',
  styleUrls: ['./assistant-knowledge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, FormsModule, LucideIconComponent, LoadingSkeletonComponent, PaginationComponent]
})
export class AssistantKnowledgeComponent implements OnInit {
  private readonly repository = inject(ASSISTANT_KNOWLEDGE_REPOSITORY_TOKEN);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly reasonLabel = REASON_LABEL;
  readonly questionMax = QUESTION_MAX;
  readonly answerMax = ANSWER_MAX;

  readonly tab = signal<KnowledgeTab>('OPEN');
  readonly pageIndex = signal(0);
  readonly gaps = signal<KnowledgeGap[]>([]);
  readonly faqs = signal<AssistantFaq[]>([]);
  readonly total = signal(0);
  readonly openCount = signal<number | null>(null);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<{ text: string; tone: 'success' | 'warning' } | null>(null);
  readonly busyId = signal<string | null>(null);

  /** Hộp thoại trả lời: câu đang trả lời, câu hỏi (sửa được cho gọn) và câu trả lời. */
  readonly answering = signal<KnowledgeGap | null>(null);
  readonly question = signal('');
  readonly answer = signal('');
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly canSave = computed(() => {
    const question = this.question().trim();
    const answer = this.answer().trim();
    return question.length >= 3 && question.length <= QUESTION_MAX && answer.length >= ANSWER_MIN
      && answer.length <= ANSWER_MAX && !this.saving();
  });

  ngOnInit(): void {
    this.load();
  }

  selectTab(tab: KnowledgeTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.pageIndex.set(0);
    this.load();
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  load(keepList = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    (keepList ? this.paging : this.loading).set(true);
    const done = () => { this.loading.set(false); this.paging.set(false); };
    if (this.tab() === 'FAQ') {
      this.request = this.repository.getFaqs().pipe(finalize(done)).subscribe({
        next: faqs => this.faqs.set(faqs),
        error: err => this.error.set(this.message(err, 'Không tải được các câu trả lời bổ sung.'))
      });
      return;
    }
    const status: KnowledgeGapStatus = this.tab() === 'OPEN' ? 'OPEN' : 'DISMISSED';
    this.request = this.repository.getGaps(status, this.pageIndex(), this.pageSize).pipe(finalize(done)).subscribe({
      next: page => {
        this.gaps.set(page.items);
        this.total.set(page.total);
        if (status === 'OPEN') this.openCount.set(page.total);
      },
      error: err => this.error.set(this.message(err, 'Không tải được danh sách câu hỏi.'))
    });
  }

  reasons(gap: KnowledgeGap): { label: string; count: number }[] {
    return (Object.entries(gap.reasons) as [KnowledgeGapReason, number][])
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1])
      .map(([reason, count]) => ({ label: REASON_LABEL[reason] ?? reason, count }));
  }

  otherSamples(gap: KnowledgeGap): string[] {
    return gap.samples.filter(sample => sample !== gap.question);
  }

  openAnswer(gap: KnowledgeGap): void {
    this.answering.set(gap);
    this.question.set(gap.question);
    this.answer.set('');
    this.formError.set(null);
  }

  closeAnswer(): void {
    if (this.saving()) return;
    this.answering.set(null);
  }

  saveAnswer(): void {
    const gap = this.answering();
    if (!gap || !this.canSave()) return;
    this.saving.set(true);
    this.formError.set(null);
    this.repository.answerGap(gap.gapId, this.question().trim(), this.answer().trim())
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.answering.set(null);
          this.removeFromQueue(gap.gapId);
          this.notice.set(result.answerable
            ? { text: 'Đã thêm vào kiến thức. Hỏi lại câu này thì trợ lý đã tìm thấy câu trả lời.', tone: 'success' }
            : { text: 'Đã lưu, nhưng khi hỏi lại trợ lý chưa tìm thấy câu trả lời. Thử viết câu hỏi giống cách người dùng hỏi hơn (ở tab Đã trả lời: gỡ rồi trả lời lại).', tone: 'warning' });
        },
        error: err => this.formError.set(this.message(err, 'Không lưu được câu trả lời. Vui lòng thử lại.'))
      });
  }

  dismiss(gap: KnowledgeGap): void {
    this.busyId.set(gap.gapId);
    this.repository.dismissGap(gap.gapId)
      .pipe(finalize(() => this.busyId.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeFromQueue(gap.gapId);
          this.notice.set({ text: 'Đã bỏ qua câu hỏi.', tone: 'success' });
        },
        error: err => this.error.set(this.message(err, 'Không bỏ qua được câu hỏi. Vui lòng thử lại.'))
      });
  }

  removeFaq(faq: AssistantFaq): void {
    const data: ConfirmDialogData = {
      title: 'Gỡ câu trả lời này?',
      message: 'Trợ lý thôi dùng câu trả lời này ngay. Câu hỏi quay lại tab Chờ trả lời để bạn trả lời lại.',
      confirmText: 'Gỡ câu trả lời',
      cancelText: 'Hủy',
      confirmColor: 'warn'
    };
    this.dialog.open(ConfirmDialogComponent, { width: '450px', data, panelClass: 'custom-premium-dialog' })
      .afterClosed().subscribe(confirmed => {
        if (!confirmed) return;
        this.busyId.set(faq.documentId);
        this.repository.deleteFaq(faq.documentId)
          .pipe(finalize(() => this.busyId.set(null)), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.faqs.update(list => list.filter(item => item.documentId !== faq.documentId));
              this.openCount.update(count => count === null ? null : count + (faq.gapId ? 1 : 0));
              this.notice.set({ text: 'Đã gỡ. Câu hỏi đã quay lại tab Chờ trả lời.', tone: 'success' });
            },
            error: err => this.error.set(this.message(err, 'Không gỡ được câu trả lời. Vui lòng thử lại.'))
          });
      });
  }

  private removeFromQueue(gapId: string): void {
    this.gaps.update(list => list.filter(item => item.gapId !== gapId));
    this.total.update(total => Math.max(0, total - 1));
    this.openCount.update(count => count === null ? null : Math.max(0, count - 1));
  }

  private message(err: { error?: { message?: string; detail?: string } } | null, fallback: string): string {
    return err?.error?.message ?? err?.error?.detail ?? fallback;
  }
}
