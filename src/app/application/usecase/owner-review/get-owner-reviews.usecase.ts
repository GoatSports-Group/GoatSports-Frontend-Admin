import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerReviewFilter,
  OwnerReviewPage
} from '@application/dto/owner-review/owner-review.dto';
import {
  OWNER_REVIEW_REPOSITORY_TOKEN,
  OwnerReviewRepository
} from '@application/ports/persistence/owner-review.repository';

@Injectable({ providedIn: 'root' })
export class GetOwnerReviewsUseCase {
  constructor(
    @Inject(OWNER_REVIEW_REPOSITORY_TOKEN)
    private readonly repository: OwnerReviewRepository
  ) { }

  execute(filter: OwnerReviewFilter): Observable<OwnerReviewPage> {
    return this.repository.getReviews(filter);
  }
}
