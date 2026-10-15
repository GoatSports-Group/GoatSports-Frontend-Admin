import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { KnowledgeGap } from '@application/dto/assistant-knowledge/assistant-knowledge.dto';
import { ASSISTANT_KNOWLEDGE_REPOSITORY_TOKEN } from '@application/ports/persistence/assistant-knowledge.repository';
import { AssistantKnowledgeComponent } from './assistant-knowledge.component';

describe('AssistantKnowledgeComponent', () => {
  const gap: KnowledgeGap = {
    gapId: 'g-1', question: 'Sân nào rẻ nhất?', samples: ['Sân nào rẻ nhất?', 'sân rẻ nhất ở đâu'], count: 7,
    reasons: { refused: 5, not_helpful: 2 }, badAnswers: ['Mình chưa có thông tin.'],
    firstAskedAt: '2026-10-10T09:00:00Z', lastAskedAt: '2026-10-16T08:00:00Z', status: 'OPEN',
    answer: null, resolvedBy: null, resolvedAt: null
  };
  const repository = { getGaps: vi.fn(), answerGap: vi.fn(), dismissGap: vi.fn(), getFaqs: vi.fn(), deleteFaq: vi.fn() };
  const dialog = { open: vi.fn() };

  beforeEach(async () => {
    repository.getGaps.mockReset().mockReturnValue(of({ items: [gap], total: 1 }));
    repository.answerGap.mockReset().mockReturnValue(of({ gap: { ...gap, status: 'ANSWERED' }, answerable: true }));
    repository.dismissGap.mockReset().mockReturnValue(of({ ...gap, status: 'DISMISSED' }));
    repository.getFaqs.mockReset().mockReturnValue(of([]));
    repository.deleteFaq.mockReset().mockReturnValue(of(undefined));
    dialog.open.mockReset().mockReturnValue({ afterClosed: () => of(true) });
    await TestBed.configureTestingModule({
      imports: [AssistantKnowledgeComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: ASSISTANT_KNOWLEDGE_REPOSITORY_TOKEN, useValue: repository },
        { provide: MatDialog, useValue: dialog }
      ]
    }).compileComponents();
  });

  it('lists open questions with how often and why they went unanswered', () => {
    const fixture = TestBed.createComponent(AssistantKnowledgeComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(repository.getGaps).toHaveBeenCalledWith('OPEN', 0, expect.any(Number));
    expect(text).toContain('Sân nào rẻ nhất?');
    expect(text).toContain('Hỏi 7 lần');
    expect(text).toContain('Trợ lý nói chưa có thông tin · 5');
    expect(text).toContain('sân rẻ nhất ở đâu');
  });

  it('saves an answer only when it is long enough and reports that the assistant can now answer', () => {
    const fixture = TestBed.createComponent(AssistantKnowledgeComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    page.openAnswer(gap);
    page.answer.set('ngắn');
    expect(page.canSave()).toBe(false);
    page.saveAnswer();
    expect(repository.answerGap).not.toHaveBeenCalled();

    page.question.set('  Sân nào rẻ nhất hiện nay?  ');
    page.answer.set(' Mở Tìm sân, chọn Sắp xếp theo Giá thấp nhất. ');
    page.saveAnswer();

    expect(repository.answerGap).toHaveBeenCalledWith('g-1', 'Sân nào rẻ nhất hiện nay?', 'Mở Tìm sân, chọn Sắp xếp theo Giá thấp nhất.');
    expect(page.answering()).toBeNull();
    expect(page.gaps()).toEqual([]);
    expect(page.openCount()).toBe(0);
    expect(page.notice()?.tone).toBe('success');
  });

  it('warns when the saved answer is still not found and keeps the dialog on errors', () => {
    const fixture = TestBed.createComponent(AssistantKnowledgeComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    repository.answerGap.mockReturnValueOnce(of({ gap, answerable: false }));
    page.openAnswer(gap);
    page.answer.set('Một câu trả lời đủ dài.');
    page.saveAnswer();
    expect(page.notice()?.tone).toBe('warning');

    repository.answerGap.mockReturnValueOnce(throwError(() => ({ error: { message: 'Chỉ quản trị viên…' } })));
    page.openAnswer(gap);
    page.answer.set('Một câu trả lời đủ dài.');
    page.saveAnswer();
    expect(page.answering()).not.toBeNull();
    expect(page.formError()).toBe('Chỉ quản trị viên…');
  });

  it('removing an answer asks first and sends the question back to the queue', () => {
    repository.getFaqs.mockReturnValue(of([{ documentId: 'd-1', question: 'Sân nào rẻ nhất?', answer: 'Sai', updatedAt: '2026-10-16T08:00:00Z',
      resolvedBy: 'admin@goat.test', gapId: 'g-1', askedCount: 7 }]));
    const fixture = TestBed.createComponent(AssistantKnowledgeComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectTab('FAQ');

    page.removeFaq(page.faqs()[0]);

    expect(dialog.open).toHaveBeenCalled();
    expect(repository.deleteFaq).toHaveBeenCalledWith('d-1');
    expect(page.faqs()).toEqual([]);
    expect(page.openCount()).toBe(2);
  });
});
