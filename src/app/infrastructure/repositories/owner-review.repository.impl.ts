import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  OwnerReviewFilter,
  OwnerReviewPage
} from '@application/dto/owner-review/owner-review.dto';
import { OwnerReviewRepository } from '@application/ports/persistence/owner-review.repository';
import { OwnerReviewApi } from '@infrastructure/api/owner-review.api';

@Injectable()
export class OwnerReviewRepositoryImpl implements OwnerReviewRepository {
  private readonly api = inject(OwnerReviewApi);

  getReviews(filter: OwnerReviewFilter): Observable<OwnerReviewPage> {
    return this.api.getReviews(filter).pipe(map(response => ({
      items: response.data?.result ?? [],
      total: response.data?.meta.total ?? 0,
      page: response.data?.meta.page ?? filter.page,
      pageSize: response.data?.meta.pageSize ?? filter.size,
      pages: response.data?.meta.pages ?? 0
    })));
  }
}
