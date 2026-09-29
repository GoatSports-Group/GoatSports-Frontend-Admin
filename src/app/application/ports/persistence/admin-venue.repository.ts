import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerVenueOverview } from '@application/dto/venue-owner-dashboard/venue-owner-dashboard.dto';
import { OwnerReview, OwnerReviewPage, OwnerReviewStatus } from '@application/dto/owner-review/owner-review.dto';

/** ACTIVE: đang mở; INACTIVE: chủ sân tự tắt; SUSPENDED: admin đình chỉ. */
export type AdminVenueStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AdminVenueFilter {
  status?: AdminVenueStatus;
  /** Tên, email, SĐT, quận hoặc thành phố. */
  query?: string;
  page: number;
  size: number;
}

export interface AdminVenuePage {
  items: OwnerVenueOverview[];
  total: number;
}

export interface AdminReviewFilter {
  status?: OwnerReviewStatus;
  rating?: number;
  venueId?: string;
  page: number;
  size: number;
}

/** Quản trị cơ sở và kiểm duyệt đánh giá (venue-service, phía admin). */
export interface AdminVenueRepository {
  getVenues(filter: AdminVenueFilter): Observable<AdminVenuePage>;
  suspend(venueId: string, reason: string): Observable<OwnerVenueOverview>;
  reinstate(venueId: string): Observable<OwnerVenueOverview>;
  getReviews(filter: AdminReviewFilter): Observable<OwnerReviewPage>;
  moderateReview(reviewId: string, status: OwnerReviewStatus): Observable<Pick<OwnerReview, 'reviewId' | 'status'>>;
}

export const ADMIN_VENUE_REPOSITORY_TOKEN = new InjectionToken<AdminVenueRepository>('ADMIN_VENUE_REPOSITORY_TOKEN');
