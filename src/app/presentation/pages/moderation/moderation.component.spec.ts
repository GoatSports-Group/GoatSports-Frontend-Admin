import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LucideAlertCircle, LucideCheck, LucideCheckCircle, LucideChevronLeft, LucideChevronRight,
  LucideClock, LucideFileText, LucideFlag, LucideGavel, LucideInfo, LucideList,
  LucideLoader2, LucidePaperclip, LucideRefreshCw, LucideRotateCcw, LucideShield,
  LucideShieldCheck, LucideUndo2, LucideUser, LucideX, provideLucideIcons
} from '@lucide/angular';
import {
  ContentAppeal,
  ContentReport,
  ModerationPage
} from '@application/dto/moderation/moderation.dto';
import { ActOnReportUseCase } from '@application/usecase/moderation/act-on-report.usecase';
import { GetAppealQueueUseCase } from '@application/usecase/moderation/get-appeal-queue.usecase';
import { GetReportQueueUseCase } from '@application/usecase/moderation/get-report-queue.usecase';
import { ReviewAppealUseCase } from '@application/usecase/moderation/review-appeal.usecase';
import { ModerationComponent } from './moderation.component';

describe('ModerationComponent', () => {
  const pendingReport: ContentReport = {
    reportId: 'report-1', reporterId: 'reporter-1', targetType: 'POST', targetId: 'post-1',
    reason: 'Nội dung có lời lẽ xúc phạm người chơi khác',
    evidence: ['evidence/1.png'], status: 'PENDING',
    createdAt: '2026-09-19T08:00:00', updatedAt: '2026-09-19T08:00:00', actions: []
  };
  const reportPage: ModerationPage<ContentReport> = {
    items: [pendingReport], total: 1, page: 0, pageSize: 20, pages: 1
  };
  const pendingAppeal: ContentAppeal = {
    appealId: 'appeal-1', actionId: 'action-1', appellantId: 'author-1',
    reason: 'Bài viết của tôi không vi phạm tiêu chuẩn', status: 'PENDING',
    reviewedBy: null, reviewedAt: null, createdAt: '2026-09-19T09:00:00',
    actionType: 'HIDE_CONTENT', targetType: 'POST', targetId: 'post-1'
  };
  const appealPage: ModerationPage<ContentAppeal> = {
    items: [pendingAppeal], total: 1, page: 0, pageSize: 20, pages: 1
  };

  const getReports = { execute: vi.fn() };
  const actOnReport = { execute: vi.fn() };
  const getAppeals = { execute: vi.fn() };
  const reviewAppeal = { execute: vi.fn() };

  beforeEach(async () => {
    getReports.execute.mockReset().mockReturnValue(of(reportPage));
    getAppeals.execute.mockReset().mockReturnValue(of(appealPage));
    actOnReport.execute.mockReset().mockReturnValue(of(pendingReport));
    reviewAppeal.execute.mockReset().mockReturnValue(of(pendingAppeal));

    await TestBed.configureTestingModule({
      imports: [ModerationComponent],
      providers: [
        provideLucideIcons(
          LucideAlertCircle, LucideCheck, LucideCheckCircle, LucideChevronLeft, LucideChevronRight,
          LucideClock, LucideFileText, LucideFlag, LucideGavel, LucideInfo, LucideList,
          LucideLoader2, LucidePaperclip, LucideRefreshCw, LucideRotateCcw, LucideShield,
          LucideShieldCheck, LucideUndo2, LucideUser, LucideX
        ),
        { provide: GetReportQueueUseCase, useValue: getReports },
        { provide: ActOnReportUseCase, useValue: actOnReport },
        { provide: GetAppealQueueUseCase, useValue: getAppeals },
        { provide: ReviewAppealUseCase, useValue: reviewAppeal }
      ]
    }).compileComponents();
  });

  it('loads the pending report queue on start', () => {
    const fixture = TestBed.createComponent(ModerationComponent);
    fixture.detectChanges();

    expect(getReports.execute).toHaveBeenCalledWith({ status: [], page: 0, size: 20 });
    expect(fixture.componentInstance.reports()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('lời lẽ xúc phạm');
  });

  it('blocks submitting an action until the reason is long enough', () => {
    const fixture = TestBed.createComponent(ModerationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.toggleReport('report-1');
    component.draftReason.set('ngắn');
    expect(component.reasonTooShort()).toBe(true);

    component.submitAction('report-1');
    expect(actOnReport.execute).not.toHaveBeenCalled();

    component.draftReason.set('Vi phạm tiêu chuẩn cộng đồng');
    expect(component.reasonTooShort()).toBe(false);
    component.submitAction('report-1');
    expect(actOnReport.execute).toHaveBeenCalledWith({
      reportId: 'report-1',
      actionType: 'HIDE_CONTENT',
      reason: 'Vi phạm tiêu chuẩn cộng đồng'
    });
  });

  it('switches to the appeal lane and requests pending appeals', () => {
    const fixture = TestBed.createComponent(ModerationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.switchLane('APPEALS');
    fixture.detectChanges();

    expect(getAppeals.execute).toHaveBeenCalledWith({ status: ['PENDING'], page: 0, size: 20 });
    expect(component.appeals()).toHaveLength(1);
    expect(component.reports()).toHaveLength(0);
  });

  it('sends the approve decision when restoring appealed content', () => {
    const fixture = TestBed.createComponent(ModerationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.switchLane('APPEALS');
    component.reviewAppeal('appeal-1', 'APPROVED');

    expect(reviewAppeal.execute).toHaveBeenCalledWith({ appealId: 'appeal-1', decision: 'APPROVED' });
    expect(component.notice()).toContain('khôi phục');
  });

  it('surfaces the backend message when the queue cannot be loaded', () => {
    getReports.execute.mockReturnValue(
      throwError(() => ({ error: { message: 'Bạn không có quyền kiểm duyệt' } }))
    );
    const fixture = TestBed.createComponent(ModerationComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('Bạn không có quyền kiểm duyệt');
    expect(fixture.nativeElement.textContent).toContain('Chưa tải được dữ liệu');
  });
});
