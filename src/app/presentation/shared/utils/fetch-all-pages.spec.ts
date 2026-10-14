import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';

const page = (index: number, pages: number, result: string[]) =>
  of({ meta: { page: index + 1, pageSize: 20, pages, total: pages * 20 }, result });

describe('fetchAllPages', () => {
  it('loads every page after the first and keeps the order', async () => {
    const fetch = vi.fn((index: number) => page(index, 3, [`p${index}`]));

    expect(await firstValueFrom(fetchAllPages(fetch))).toEqual(['p0', 'p1', 'p2']);
    expect(fetch.mock.calls.map(([index]) => index)).toEqual([0, 1, 2]);
  });

  it('stops after one request when there is a single page', async () => {
    const fetch = vi.fn((index: number) => page(index, 1, ['only']));

    expect(await firstValueFrom(fetchAllPages(fetch))).toEqual(['only']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
