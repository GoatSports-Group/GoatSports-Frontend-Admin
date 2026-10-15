import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AssistantKnowledgeRepository } from '@application/ports/persistence/assistant-knowledge.repository';
import {
  AssistantFaq,
  KnowledgeGap,
  KnowledgeGapAnswerResult,
  KnowledgeGapPage,
  KnowledgeGapStatus
} from '@application/dto/assistant-knowledge/assistant-knowledge.dto';

/** ai-service (FastAPI) trả thẳng JSON, không bọc BaseResponse như các service Spring; trang số từ 0. */
@Injectable()
export class AssistantKnowledgeRepositoryImpl implements AssistantKnowledgeRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-service/api/v1/ai/assistant-admin`;

  getGaps(status: KnowledgeGapStatus, page: number, size: number): Observable<KnowledgeGapPage> {
    const params = new HttpParams().set('status', status).set('page', page).set('size', size);
    return this.http.get<KnowledgeGapPage>(`${this.baseUrl}/gaps`, { params });
  }

  answerGap(gapId: string, question: string, answer: string): Observable<KnowledgeGapAnswerResult> {
    return this.http.post<KnowledgeGapAnswerResult>(`${this.baseUrl}/gaps/${gapId}/answer`, { question, answer });
  }

  dismissGap(gapId: string): Observable<KnowledgeGap> {
    return this.http.post<KnowledgeGap>(`${this.baseUrl}/gaps/${gapId}/dismiss`, {});
  }

  draftGap(gapId: string): Observable<KnowledgeGap> {
    return this.http.post<KnowledgeGap>(`${this.baseUrl}/gaps/${gapId}/draft`, {});
  }

  getFaqs(): Observable<AssistantFaq[]> {
    return this.http.get<AssistantFaq[]>(`${this.baseUrl}/faqs`);
  }

  deleteFaq(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/faqs/${documentId}`);
  }
}
