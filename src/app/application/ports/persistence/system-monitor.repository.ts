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

/** Giám sát hệ thống (admin): microservice qua audit-service/Prometheus, năng lực AI qua ai-service. */
export interface SystemMonitorRepository {
  getServicesHealth(): Observable<SystemHealth>;
  getAiStatus(): Observable<AiStatus>;
}

export const SYSTEM_MONITOR_REPOSITORY_TOKEN = new InjectionToken<SystemMonitorRepository>('SYSTEM_MONITOR_REPOSITORY_TOKEN');
