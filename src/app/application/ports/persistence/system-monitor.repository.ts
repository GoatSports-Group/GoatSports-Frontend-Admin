import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type ServiceHealthStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

/** Số liệu Prometheus, cửa sổ 5 phút; null = chưa có dữ liệu (không phải 0). */
export interface ServiceHealth {
  service: string;
  status: ServiceHealthStatus;
  requestsPerSecond: number | null;
  /** 0–1 */
  errorRate: number | null;
  p95LatencyMs: number | null;
  /** JVM: 0–1 CPU của máy; ai-service (Python): số lõi đang dùng. */
  cpuUsage: number | null;
  memoryUsedBytes: number | null;
  uptimeSeconds: number | null;
}

export interface SystemHealth {
  checkedAt: string;
  /** false: không đọc được Prometheus — khác với "service ngừng". */
  metricsAvailable: boolean;
  grafanaUrl: string | null;
  services: ServiceHealth[];
}

export interface AiModelVersion {
  modelName: string;
  version: string;
  trainedAt: string | null;
  metrics: Record<string, number>;
  status: string;
}

export interface AiCapabilityOverview {
  capability: string;
  algorithm: string;
  storage: string;
  /** READY | DEGRADED */
  status: string;
  detail: string;
  activeModel: AiModelVersion | null;
}

export interface AiDependency {
  name: string;
  status: 'UP' | 'DOWN';
  latencyMs: number | null;
  detail: string | null;
}

export interface AiStatus {
  checkedAt: string;
  dependencies: AiDependency[];
  capabilities: AiCapabilityOverview[];
}

/** Request/giây theo thời gian; điểm i ứng với start + i * stepSeconds, null = không có số liệu. */
export interface ServiceTrends {
  range: '1h' | '24h';
  start: string;
  stepSeconds: number;
  requestsPerSecond: Record<string, (number | null)[]>;
}

/** Một lần dịch vụ ngừng / suy giảm; endedAt null = còn đang diễn ra. */
export interface ServiceIncident {
  id: string;
  service: string;
  status: 'DOWN' | 'DEGRADED';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  /** Đã báo admin qua chuông (ngừng quá 2 phút). */
  alerted: boolean;
}

export interface InfrastructureStatus {
  checkedAt: string;
  checks: { name: string; status: 'UP' | 'DOWN'; latencyMs: number | null; detail: string | null }[];
  /** lag = số message đã vào topic mà group chưa xử lý. */
  consumers: { groupId: string; state: string; members: number; topics: string[]; lag: number }[];
}

export interface BackgroundJob {
  service: string;
  job: string | null;
  label: string | null;
  pending: number;
  running: number;
  failedLast24h: number;
  oldestPendingAt: string | null;
  /** false = không gọi được service sở hữu job. */
  available: boolean;
  error: string | null;
}

/** Giám sát hệ thống (admin): microservice qua audit-service/Prometheus, năng lực AI qua ai-service. */
export interface SystemMonitorRepository {
  getServicesHealth(): Observable<SystemHealth>;
  getAiStatus(): Observable<AiStatus>;
  getTrends(range: '1h' | '24h'): Observable<ServiceTrends>;
  getIncidents(days: number): Observable<ServiceIncident[]>;
  getInfrastructure(): Observable<InfrastructureStatus>;
  getJobs(): Observable<BackgroundJob[]>;
}

export const SYSTEM_MONITOR_REPOSITORY_TOKEN = new InjectionToken<SystemMonitorRepository>('SYSTEM_MONITOR_REPOSITORY_TOKEN');
