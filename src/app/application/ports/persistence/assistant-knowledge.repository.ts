import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AssistantFaq,
  KnowledgeGapAnswerResult,
  KnowledgeGap,
  KnowledgeGapPage,
  KnowledgeGapStatus
} from '@application/dto/assistant-knowledge/assistant-knowledge.dto';

/** Kiến thức của trợ lý GOAT AI (ai-service, chỉ ADMIN): câu chưa trả lời được và câu trả lời bổ sung. */
export interface AssistantKnowledgeRepository {
  /** page bắt đầu từ 0. */
  getGaps(status: KnowledgeGapStatus, page: number, size: number): Observable<KnowledgeGapPage>;
  answerGap(gapId: string, question: string, answer: string): Observable<KnowledgeGapAnswerResult>;
  dismissGap(gapId: string): Observable<KnowledgeGap>;
  getFaqs(): Observable<AssistantFaq[]>;
  deleteFaq(documentId: string): Observable<void>;
}

export const ASSISTANT_KNOWLEDGE_REPOSITORY_TOKEN =
  new InjectionToken<AssistantKnowledgeRepository>('ASSISTANT_KNOWLEDGE_REPOSITORY_TOKEN');
