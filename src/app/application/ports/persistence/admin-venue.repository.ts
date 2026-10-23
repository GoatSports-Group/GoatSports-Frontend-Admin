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
  /** Chỉ lấy các cơ sở này (tra tên theo lô, tối đa 50). */
  ids?: string[];
  /** Chỉ lấy cơ sở của chủ sân này (Tin nhắn → "Xem cơ sở của chủ sân"). */
  ownerId?: string;
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
  /** Chỉ đánh giá AI nghi vi phạm (mức từ 2). */
  aiFlagged?: boolean;
  page: number;
  size: number;
}

/** Một khu vực đã nhập sân ngoài hệ thống (OpenStreetMap). */
export interface ExternalVenueRegionSummary {
  region: string;
  venueCount: number;
  lastImportedAt: string;
}

/** Khung nam - tây - bắc - đông của khu vực cần nhập (tối đa khoảng một thành phố). */
export interface ExternalVenueImportRequest {
  region: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Quản trị cơ sở và kiểm duyệt đánh giá (venue-service, phía admin). */
export interface AdminVenueRepository {
  getVenues(filter: AdminVenueFilter): Observable<AdminVenuePage>;
  suspend(venueId: string, reason: string): Observable<OwnerVenueOverview>;
  reinstate(venueId: string): Observable<OwnerVenueOverview>;
  getReviews(filter: AdminReviewFilter): Observable<OwnerReviewPage>;
  moderateReview(reviewId: string, status: OwnerReviewStatus): Observable<Pick<OwnerReview, 'reviewId' | 'status'>>;
  getExternalVenueSummary(): Observable<ExternalVenueRegionSummary[]>;
  /** Chạy nền ở venue-service; xem kết quả bằng getExternalVenueSummary vài phút sau. */
  importExternalVenues(request: ExternalVenueImportRequest): Observable<void>;
}

export const ADMIN_VENUE_REPOSITORY_TOKEN = new InjectionToken<AdminVenueRepository>('ADMIN_VENUE_REPOSITORY_TOKEN');
