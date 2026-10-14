import { describe, expect, it } from 'vitest';
import { buildPageParams } from './build-page-params';

describe('buildPageParams', () => {
  it('sends the 0-based index as-is by default and shifts it for one-indexed services', () => {
    expect(buildPageParams({ page: 1, size: 20 }).get('page')).toBe('1');
    expect(buildPageParams({ page: 0, size: 20 }, true).get('page')).toBe('1');
    expect(buildPageParams({ page: 1, size: 20 }, true).get('page')).toBe('2');
  });
});
