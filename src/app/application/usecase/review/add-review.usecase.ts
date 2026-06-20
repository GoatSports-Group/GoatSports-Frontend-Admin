import { ReviewRepository, REVIEW_REPOSITORY_TOKEN } from '@application/ports/review.repository';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Review } from '@application/dto/review/review.dto';

@Injectable({
  providedIn: 'root'
})
export class AddReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN) private reviewRepository: ReviewRepository
  ) {}

  execute(venueId: string, rating: number, comment: string, userFullName: string): Observable<Review> {
    return this.reviewRepository.addReview(venueId, rating, comment, userFullName);
  }
}
