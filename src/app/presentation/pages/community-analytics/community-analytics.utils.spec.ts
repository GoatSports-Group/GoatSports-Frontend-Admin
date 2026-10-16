import { describe, expect, it } from 'vitest';
import { changeOf, heatLevel, linePaths, peakCell } from './community-analytics.utils';

describe('community analytics utils', () => {
  it('scales the line to the highest day and closes the area on the baseline', () => {
    const { line, area, max, points } = linePaths([0, 5, 10]);
    expect(max).toBe(10);
    expect(points.map(point => point.y)).toEqual([100, 50, 0]);
    expect(line).toBe('M0.00,100.00 L50.00,50.00 L100.00,0.00');
    expect(area.endsWith('L100.00,100 L0.00,100 Z')).toBe(true);
  });

  it('draws a single day as a flat segment and an empty series as nothing', () => {
    expect(linePaths([4]).line).toBe('M0.00,0.00 L100.00,0.00');
    expect(linePaths([]).line).toBe('');
  });

  it('keeps zero cells at level 0 and any activity at level 1 or more', () => {
    expect(heatLevel(0, 20)).toBe(0);
    expect(heatLevel(1, 20)).toBe(1);
    expect(heatLevel(20, 20)).toBe(5);
    expect(heatLevel(11, 20)).toBe(3);
  });

  it('compares with the previous period', () => {
    expect(changeOf(150, 100)?.text).toContain('+50');
    expect(changeOf(50, 100)?.tone).toBe('bad');
    expect(changeOf(5, 0)).toBeNull();
    expect(changeOf(0, 0)?.tone).toBe('flat');
  });

  it('finds the busiest cell', () => {
    expect(peakCell([{ dayOfWeek: 1, hour: 7, count: 2 }, { dayOfWeek: 6, hour: 19, count: 9 }])?.hour).toBe(19);
    expect(peakCell([{ dayOfWeek: 1, hour: 7, count: 0 }])).toBeNull();
  });
});
