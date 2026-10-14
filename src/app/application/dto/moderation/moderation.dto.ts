export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';
export type ReportTargetType = 'POST' | 'COMMENT' | 'USER' | 'VENUE' | 'MESSAGE' | 'REVIEW';
export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ModerationActionType =
  | 'HIDE_CONTENT'
  | 'REMOVE_CONTENT'
  | 'RESTORE_CONTENT'
  | 'WARNING'
  | 'DISMISS_REPORT'
  | 'SUSPEND_USER'
  | 'SUSPEND_VENUE';

export interface ModerationActionItem {
  actionId: string;
  moderatorId: string;
  actionType: ModerationActionType;
  reason: string;
  actionAt: string;
}

/**
 * Gợi ý kiểm duyệt của AI (LLM qua ai-service): nhãn, mức 0–3 và một câu lý do. Chỉ là gợi ý để xếp hàng đợi;
 * admin luôn là người quyết định. `null` khi AI chưa đọc hoặc không đọc được.
 */
export interface AiVerdict {
  label: 'NONE' | 'SPAM' | 'HARASSMENT' | 'HATE' | 'SEXUAL' | 'VIOLENCE' | 'SCAM' | 'OTHER' | string;
  severity: number;
  reason: string;
  checkedAt: string;
}

export interface ContentReport {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  evidence: string[];
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  actions: ModerationActionItem[];
  ai: AiVerdict | null;
}

export interface ContentAppeal {
  appealId: string;
  actionId: string;
  appellantId: string;
  reason: string;
  status: AppealStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  actionType: ModerationActionType | null;
  targetType: ReportTargetType | null;
  targetId: string | null;
}

/** Nội dung bị báo cáo / khiếu nại (đọc được cả khi đã ẩn hoặc gỡ). `found = false`: không còn, hoặc không thuộc mạng xã hội. */
export interface ModerationTarget {
  targetType: ReportTargetType;
  targetId: string;
  found: boolean;
  authorId: string | null;
  content: string | null;
  status: string | null;
  attachmentCount: number;
  postId: string | null;
  createdAt: string | null;
}

export interface ModerationPageFilter {
  status?: string[];
  page: number;
  size: number;
}

export interface ModerationPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface ModerateContentPayload {
  reportId: string;
  actionType: ModerationActionType;
  reason: string;
}

export interface ReviewAppealPayload {
  appealId: string;
  decision: Exclude<AppealStatus, 'PENDING'>;
}
