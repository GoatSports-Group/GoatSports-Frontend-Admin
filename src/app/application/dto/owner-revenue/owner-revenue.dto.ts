export interface OwnerRevenueFilter {
  venueId?: string;
  fromDate: string;
  toDate: string;
}

export interface OwnerRevenuePeriod {
  fromDate: string;
  toDate: string;
  bookingCount: number;
  paidBookingCount: number;
  totalRevenue: number;
}

export interface OwnerRevenueStatusBreakdown {
  status: string;
  paymentCount: number;
  nominalAmount: number;
}

export interface OwnerDailyRevenue {
  date: string;
  revenue: number;
  succeededPaymentCount: number;
}

export interface OwnerRevenueReport {
  scopeVenueId: string | null;
  currency: string;
  periodBasis: 'BOOKING_PLAY_DATE';
  currentPeriod: OwnerRevenuePeriod;
  previousPeriod: OwnerRevenuePeriod;
  revenueChangePercentage: number | null;
  bookingCountChangePercentage: number | null;
  paymentStatusBreakdown: OwnerRevenueStatusBreakdown[];
  dailyRevenue: OwnerDailyRevenue[];
}
