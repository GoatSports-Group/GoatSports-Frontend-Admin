import { ReviewRepository, REVIEW_REPOSITORY_TOKEN } from '@application/ports/review.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DeleteReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) {}

  execute(id: string): Observable<boolean> {
    return this.reviewRepository.deleteReview(id);
  }
}
