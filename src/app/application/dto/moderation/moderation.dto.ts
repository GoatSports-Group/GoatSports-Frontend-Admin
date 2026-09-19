export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';
export type ReportTargetType = 'POST' | 'COMMENT' | 'USER' | 'VENUE';
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
