export type OwnerReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'REMOVED';

export interface OwnerReview {
  reviewId: string;
  venueId: string;
  venueName: string;
  venueCourtId: string;
  courtName: string;
  bookingId: string;
  bookingCode: string;
  playDate: string;
  startTime: string;
  endTime: string;
  rating: number;
  content: string | null;
  status: OwnerReviewStatus;
  createdAt: string;
}

export interface OwnerReviewFilter {
  venueId?: string;
  venueCourtId?: string;
  rating?: number;
  fromDate?: string;
  toDate?: string;
  page: number;
  size: number;
}

export interface OwnerReviewPage {
  items: OwnerReview[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
