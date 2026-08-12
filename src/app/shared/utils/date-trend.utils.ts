export interface TrendResult {
  trendText: string;
  isPositive: boolean;
}

/**
 * Calculates weekly percentage or count trend based on dateField values in items.
 */
export function calculateWeeklyTrend(items: any[], dateField: string): TrendResult {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let newCount = 0;
  let oldCount = 0;

  items.forEach(item => {
    const dateStr = item[dateField] || item['createdAt'];
    if (!dateStr) return;
    const date = new Date(dateStr);
    if (date > sevenDaysAgo) {
      newCount++;
    } else if (date <= sevenDaysAgo && date > fourteenDaysAgo) {
      oldCount++;
    }
  });

  if (oldCount === 0) {
    if (newCount > 0) {
      return { trendText: `+${newCount} mới`, isPositive: true };
    }
    return { trendText: '0%', isPositive: true };
  }

  const percent = Math.round(((newCount - oldCount) / oldCount) * 100);
  if (percent >= 0) {
    return { trendText: `+${percent}%`, isPositive: true };
  } else {
    return { trendText: `${percent}%`, isPositive: false };
  }
}
