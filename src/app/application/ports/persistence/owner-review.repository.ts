import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OwnerReviewFilter,
  OwnerReviewPage
} from '@application/dto/owner-review/owner-review.dto';

export interface OwnerReviewRepository {
  getReviews(filter: OwnerReviewFilter): Observable<OwnerReviewPage>;
}

export const OWNER_REVIEW_REPOSITORY_TOKEN = new InjectionToken<OwnerReviewRepository>(
  'OWNER_REVIEW_REPOSITORY_TOKEN'
);
