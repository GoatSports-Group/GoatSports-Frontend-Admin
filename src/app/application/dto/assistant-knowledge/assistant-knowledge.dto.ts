/** OPEN: chờ admin; ANSWERED: đã thành tài liệu FAQ; DISMISSED: bỏ qua (lạc đề / cần tính năng mới). */
export type KnowledgeGapStatus = 'OPEN' | 'ANSWERED' | 'DISMISSED';

/** Lý do trợ lý chưa trả lời được (mã từ ai-service). */
export type KnowledgeGapReason = 'no_documents_no_tools' | 'refused' | 'llm_unavailable' | 'not_helpful';

/** Một câu (hoặc nhóm câu gần như trùng) trợ lý GOAT AI chưa trả lời được. */
export interface KnowledgeGap {
  gapId: string;
  question: string;
  /** Các cách hỏi đã gặp (tối đa 5). */
  samples: string[];
  count: number;
  reasons: Partial<Record<KnowledgeGapReason, number>>;
  /** Câu trả lời người dùng đã báo "Chưa hữu ích" (tối đa 3). */
  badAnswers: string[];
  firstAskedAt: string;
  lastAskedAt: string;
  status: KnowledgeGapStatus;
  answer: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface KnowledgeGapPage {
  items: KnowledgeGap[];
  total: number;
}

export interface KnowledgeGapAnswerResult {
  gap: KnowledgeGap;
  /** Hỏi lại ngay câu gốc thì trợ lý đã tìm thấy câu trả lời mới. */
  answerable: boolean;
}

/** Câu trả lời bổ sung admin đã thêm vào kiến thức của trợ lý. */
export interface AssistantFaq {
  documentId: string;
  question: string;
  answer: string | null;
  updatedAt: string;
  resolvedBy: string | null;
  gapId: string | null;
  askedCount: number;
}
