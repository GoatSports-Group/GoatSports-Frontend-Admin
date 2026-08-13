import { StatusDistribution } from '../../models';
import { DonutSegment } from './status-chart.models';

export interface DonutChartData {
  total: number;
  segments: DonutSegment[];
}

export function calculateDonutChart(distribution: StatusDistribution | null): DonutChartData {
  if (!distribution) return { total: 0, segments: [] };

  const rawSegments = [
    { label: 'Thành công (2xx)', value: distribution.status2xx, color: '#10b981' },
    { label: 'Chuyển hướng (3xx)', value: distribution.status3xx, color: '#3b82f6' },
    { label: 'Lỗi phía Client (4xx)', value: distribution.status4xx, color: '#f97316' },
    { label: 'Lỗi phía Server (5xx)', value: distribution.status5xx, color: '#ef4444' }
  ];
  const total = rawSegments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return { total, segments: [] };

  let cumulativePercentage = 0;
  const segments = rawSegments.map(segment => {
    const percentage = (segment.value / total) * 100;
    const dashOffset = cumulativePercentage;
    cumulativePercentage += percentage;

    return {
      ...segment,
      percentage,
      dashArray: `${percentage} ${100 - percentage}`,
      dashOffset: -dashOffset
    };
  }).filter(segment => segment.value > 0);

  return { total, segments };
}
