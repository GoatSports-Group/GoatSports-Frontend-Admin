export interface OwnerRevenueFilter {
  venueId?: string;
  fromDate: string;
  toDate: string;
}

export interface OwnerRevenueReportExportFilter extends OwnerRevenueFilter {
  venueName: string;
  periodLabel: string;
}

export interface OwnerCustomerMetricsFilter {
  venueId: string;
  month: string;
}

export interface OwnerCustomerMetricsPeriod {
  fromDate: string;
  toDate: string;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  returningRate: number;
}

export interface OwnerCustomerMetricsReport {
  scopeVenueId: string;
  periodBasis: 'BOOKING_PLAY_DATE';
  currentPeriod: OwnerCustomerMetricsPeriod;
  previousPeriod: OwnerCustomerMetricsPeriod;
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

export interface OwnerHourlyRevenue {
  hour: number;
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
  hourlyRevenue?: OwnerHourlyRevenue[];
}

/** Bao cao dinh ky da chot (report-service). Pham vi: moi co so cua chu san. */
export type PeriodicReportType = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

export interface PeriodicReport {
  reportId: string;
  periodType: PeriodicReportType;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  bookingCount: number;
  paidBookingCount: number;
  revenueChangePercentage: number | null;
  bookingCountChangePercentage: number | null;
  generatedAt: string;
}

export type PeriodicReportFormat = 'pdf' | 'xlsx' | 'csv';
