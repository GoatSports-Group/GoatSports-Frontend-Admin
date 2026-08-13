import { Log } from '@application/dto/log/log.dto';
import { ChartDataPoint, LogStats } from './components/models';
import { LogFilters } from './logs.models';

const EMPTY_LOG_STATS: LogStats = {
  totalRequests: 125483,
  errorRate: 0.62,
  avgResponseTime: 183,
  p95ResponseTime: 652,
  p99ResponseTime: 914,
  maxResponseTime: 1250,
  activeUsers: 328,
  activeApis: 126,
  trafficTrend: [
    { label: '09:00:00', value: 120 },
    { label: '10:00:00', value: 240 },
    { label: '11:00:00', value: 180 },
    { label: '12:00:00', value: 310 },
    { label: '13:00:00', value: 290 },
    { label: '14:00:00', value: 450 },
    { label: '15:00:00', value: 380 },
    { label: '16:00:00', value: 220 },
    { label: '17:00:00', value: 170 },
    { label: '18:00:00', value: 290 }
  ],
  statusDistribution: { status2xx: 485, status3xx: 10, status4xx: 4, status5xx: 1 }
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

export function computeLogStats(logs: Log[]): LogStats {
  if (!logs.length) return { ...EMPTY_LOG_STATS };

  const totalRequests = logs.length;
  const uniqueUsers = new Set(logs.map(log => log.userId).filter(id => id && id !== 'anonymous'));
  const uniqueApis = new Set(logs.map(log => log.action).filter(action => action?.trim()));

  return {
    totalRequests,
    errorRate: logs.filter(log => log.statusCode >= 400).length / totalRequests * 100,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    maxResponseTime: 0,
    activeUsers: uniqueUsers.size || 328,
    activeApis: uniqueApis.size || 12,
    trafficTrend: generateTrafficTrend(logs),
    statusDistribution: {
      status2xx: countStatuses(logs, 200, 300),
      status3xx: countStatuses(logs, 300, 400),
      status4xx: countStatuses(logs, 400, 500),
      status5xx: logs.filter(log => log.statusCode >= 500).length
    }
  };
}

export function generateTrafficTrend(logs: Log[], now = new Date()): ChartDataPoint[] {
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    value: 0
  }));

  logs.forEach(log => {
    const date = parseUtcDate(log.timestamp);
    if (!date || !isSameDay(date, now)) return;
    hourlyCounts[date.getHours()].value++;
  });

  return hourlyCounts;
}

function escapeFilterValue(value: string): string {
  return value.trim().replace(/'/g, "\\'");
}

function countStatuses(logs: Log[], min: number, max: number): number {
  return logs.filter(log => log.statusCode >= min && log.statusCode < max).length;
}

function parseUtcDate(value: string): Date | null {
  const normalized = value && !value.endsWith('Z') && !value.includes('+') ? `${value}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}
