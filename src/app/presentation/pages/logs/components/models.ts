export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface StatusDistribution {
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
}

export interface LogStats {
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  activeUsers: number;
  activeApis: number;
  trafficTrend: ChartDataPoint[];
  statusDistribution: StatusDistribution;
}
