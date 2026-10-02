import { Log } from '@application/dto/log/log.dto';
import { LogStatsResult } from '@application/dto/log/log-stats.dto';
import { ChartDataPoint, LogStats } from './components/models';
import { LogFilters } from './logs.models';

/** Chua co du lieu: tat ca bang 0 (khong bao gio dien so minh hoa). */
export const EMPTY_LOG_STATS: LogStats = {
  totalRequests: 0, errorRate: 0, avgResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0, maxResponseTime: 0,
  activeUsers: 0, activeApis: 0, trafficTrend: [],
  statusDistribution: { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 }
};

export function buildLogFilter(filters: LogFilters): string {
  const result: string[] = [];
  const description = escapeFilterValue(filters.description);
  const action = escapeFilterValue(filters.action).toUpperCase();

  if (description) result.push(`description ~ '${description}'`);
  if (action) result.push(`action = '${action}'`);
  if (filters.fromDate) result.push(`timestamp >= '${filters.fromDate}T00:00:00Z'`);
  if (filters.toDate) result.push(`timestamp <= '${filters.toDate}T23:59:59Z'`);
  return result.join(' and ');
}

export function mergeUniqueLogActions(current: string[], logs: Log[]): string[] {
  const actions = new Set(current);
  logs.forEach(log => {
    const action = log.action?.trim().toUpperCase();
    if (action) actions.add(action);
  });
  return [...actions].sort();
}

/** Ket qua /logs/stats cho "hom nay" (bat dau 00:00 gio may) thanh du lieu cua KPI va bieu do. */
export function toLogStats(result: LogStatsResult, dayStart: Date): LogStats {
  const total = result.totalRequests;
  return {
    ...EMPTY_LOG_STATS,
    totalRequests: total,
    errorRate: total ? result.errorRequests / total * 100 : 0,
    activeUsers: result.activeUsers,
    activeApis: result.actions.length,
    trafficTrend: result.hourly.map((value, index) => {
      const hour = new Date(dayStart.getTime() + index * 3_600_000).getHours();
      return { label: `${String(hour).padStart(2, '0')}:00`, value };
    }),
    statusDistribution: {
      status2xx: result.status2xx, status3xx: result.status3xx, status4xx: result.status4xx, status5xx: result.status5xx
    }
  };
}

/** [00:00 hom nay, 00:00 ngay mai) theo gio may, doi sang UTC 'yyyy-MM-ddTHH:mm:ss' nhu timestamp da luu. */
export function todayUtcRange(now = new Date()): { from: string; to: string; dayStart: Date } {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const utc = (date: Date) => date.toISOString().slice(0, 19);
  return { from: utc(dayStart), to: utc(dayEnd), dayStart };
}

function escapeFilterValue(value: string): string {
  return value.trim().replace(/'/g, "\\'");
}

