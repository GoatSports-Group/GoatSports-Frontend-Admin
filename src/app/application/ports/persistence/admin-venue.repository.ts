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

/** Khung nam - tây - bắc - đông của khu vực cần nhập (tối đa 3 độ mỗi chiều, cỡ một tỉnh). */
export interface ExternalVenueImportRequest {
  region: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Một sân đã nhập từ OpenStreetMap. */
export interface ExternalVenue {
  externalVenueId: string;
  name: string;
  sportTypes: string[];
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  source: string;
}

export interface ExternalVenuePage {
  items: ExternalVenue[];
  total: number;
  pages: number;
}

/** Kết quả tìm địa danh (Nominatim qua venue-service); `bounds` là khung bao của tỉnh / quận nếu có. */
export interface PlaceSearchResult {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  bounds: Omit<ExternalVenueImportRequest, 'region'> | null;
}

/** Đợt nhập gần nhất. venue-service hỏi Overpass từng ô 0,25°; ô quá tải bị bỏ qua (PARTIAL), nhập lại để bổ sung. */
export interface ExternalVenueImportStatus {
  region: string;
  state: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  doneTiles: number;
  totalTiles: number;
  failedTiles: number;
  savedCount: number;
  startedAt: string;
  finishedAt: string | null;
}

/** Quản trị cơ sở và kiểm duyệt đánh giá (venue-service, phía admin). */
export interface AdminVenueRepository {
  getVenues(filter: AdminVenueFilter): Observable<AdminVenuePage>;
  suspend(venueId: string, reason: string): Observable<OwnerVenueOverview>;
  reinstate(venueId: string): Observable<OwnerVenueOverview>;
  getReviews(filter: AdminReviewFilter): Observable<OwnerReviewPage>;
  moderateReview(reviewId: string, status: OwnerReviewStatus): Observable<Pick<OwnerReview, 'reviewId' | 'status'>>;
  getExternalVenueSummary(): Observable<ExternalVenueRegionSummary[]>;
  /** Chạy nền ở venue-service; theo dõi bằng getExternalVenueImportStatus. */
  importExternalVenues(request: ExternalVenueImportRequest): Observable<void>;
  /** null khi chưa nhập lần nào từ lúc venue-service khởi động. */
  getExternalVenueImportStatus(): Observable<ExternalVenueImportStatus | null>;
  /** Sân đã nhập của một khu vực, theo tên; `page` tính từ 0. */
  getExternalVenuesByRegion(region: string, page: number, size: number): Observable<ExternalVenuePage>;
  /** Tìm tỉnh, thành, quận ở Việt Nam để chọn vùng nhập trên bản đồ. */
  searchPlaces(query: string): Observable<PlaceSearchResult[]>;
}

export const ADMIN_VENUE_REPOSITORY_TOKEN = new InjectionToken<AdminVenueRepository>('ADMIN_VENUE_REPOSITORY_TOKEN');
