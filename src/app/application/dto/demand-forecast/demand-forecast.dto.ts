/** Một giờ dự báo: tỉ lệ lấp đầy (0–1) ở mức quantile 10% / 50% / 90% (ai-service, Chronos-Bolt). */
export interface DemandForecastHour {
  /** Giờ địa phương, không có múi giờ: "2026-10-10T19:00:00". */
  start: string;
  lower: number;
  median: number;
  upper: number;
  /** Ngoài 64 giờ đầu: dự báo chạy nối, khoảng tin cậy kém chắc chắn hơn. */
  extended: boolean;
}

/** Dự báo lại tuần vừa qua rồi so với thực tế và với cách đoán "giống tuần trước". */
export interface DemandBacktest {
  hours: number;
  modelMae: number;
  baselineMae: number;
  coverage: number;
}

export interface VenueDemandForecast {
  forecastId: string;
  venueId: string;
  modelName: string;
  modelRevision: string;
  generatedAt: string;
  forecastStart: string;
  courtCount: number;
  openTime: string | null;
  closeTime: string | null;
  historyHours: number;
  hours: DemandForecastHour[];
  backtest: DemandBacktest | null;
}
