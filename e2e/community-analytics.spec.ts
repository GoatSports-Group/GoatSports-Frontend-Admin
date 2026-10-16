import { expect, Page, test } from '@playwright/test';
import { mockAdminApi } from './fixtures/api.fixture';

// Dashboard "Hoạt động cộng đồng": một lời gọi social-service (kèm tổng kỳ trước), tên người dùng tra theo lô.

const AUTHOR = 'u0000000-0000-4000-8000-000000000301';
const MEMBER = 'u0000000-0000-4000-8000-000000000302';

function socialStats(fromDate: string, toDate: string) {
  const days: { date: string; posts: number; comments: number; likes: number; shares: number; activeUsers: number }[] = [];
  for (const day = new Date(`${fromDate}T00:00:00`); day <= new Date(`${toDate}T00:00:00`); day.setDate(day.getDate() + 1)) {
    const i = days.length;
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    days.push({ date: iso, posts: 4 + (i % 5) + (weekend ? 4 : 0), comments: 6 + (i % 7), likes: 30 + i + (weekend ? 20 : 0),
      shares: i % 3, activeUsers: 20 + i + (weekend ? 10 : 0) });
  }
  const heatmap = [];
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
    for (let hour = 0; hour < 24; hour++) {
      const evening = hour >= 17 && hour <= 21 ? 12 : 0;
      heatmap.push({ dayOfWeek, hour, count: hour < 6 ? 0 : evening + (dayOfWeek >= 6 ? 6 : 1) + (hour % 3) });
    }
  }
  heatmap.find(cell => cell.dayOfWeek === 6 && cell.hour === 19)!.count = 40;
  return {
    fromDate, toDate,
    totals: { posts: 236, shares: 21, comments: 263, likes: 1455, saves: 171, activeUsers: 122, postingUsers: 94, playerCalls: 53, playerCallsFilled: 44 },
    previous: { posts: 179, shares: 14, comments: 176, likes: 994, saves: 113, activeUsers: 120, postingUsers: 79, playerCalls: 37, playerCallsFilled: 37 },
    byDay: days,
    bySport: [
      { sport: 'FOOTBALL', posts: 77, interactions: 621 }, { sport: 'BADMINTON', posts: 72, interactions: 493 },
      { sport: 'PICKLEBALL', posts: 39, interactions: 310 }, { sport: 'TENNIS', posts: 24, interactions: 162 }
    ],
    trendingTags: [
      { tag: 'bongda', posts: 76, authors: 37, previousPosts: 59 }, { tag: 'caulong', posts: 70, authors: 30, previousPosts: 62 },
      { tag: 'timdoi', posts: 52, authors: 38, previousPosts: 37 }, { tag: 'giaidau', posts: 9, authors: 6, previousPosts: 0 }
    ],
    heatmap,
    topPosts: [
      { postId: 'p1', authorId: AUTHOR, excerpt: 'Kỹ thuật dink ở khu kitchen là chìa khóa thắng điểm #pickleball #kythuat', sport: 'PICKLEBALL',
        publishedAt: `${toDate}T19:05:00`, likes: 20, comments: 8, shares: 1 }
    ],
    topMembers: [{ userId: MEMBER, posts: 10, comments: 4, reactions: 12 }]
  };
}

async function mockSocialStats(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route(url => url.pathname.endsWith('/social-service/api/v1/admin/stats/social'), route => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(`${params.get('fromDate')}..${params.get('toDate')}`);
    return route.fulfill({ json: { statusCode: 200, data: socialStats(params.get('fromDate')!, params.get('toDate')!) } });
  });
  await page.route(url => url.pathname.endsWith('/auth-service/api/v1/admin/users/summaries'), route => route.fulfill({
    json: { statusCode: 200, data: [
      { userId: AUTHOR, fullName: 'Lý Hoàng Tuấn', email: 'sim000@demo.goatsports.vn' },
      { userId: MEMBER, fullName: 'Trần Thu Hà', email: 'sim001@demo.goatsports.vn' }
    ] }
  }));
  return requests;
}

test('hoạt động cộng đồng: chỉ số so kỳ trước, biểu đồ đổi chỉ số, heatmap, bài nổi bật có tên tác giả', async ({ page }) => {
  await mockAdminApi(page, 'ADMIN');
  const requests = await mockSocialStats(page);
  await page.goto('/admin/community-analytics');

  await expect(page.getByRole('heading', { name: 'Hoạt động cộng đồng', level: 1 })).toBeVisible();
  const active = page.locator('.kpi').filter({ hasText: 'Người hoạt động' });
  await expect(active).toContainText('122');
  await expect(active).toContainText('+1,7% so với kỳ trước');
  await expect(page.locator('.kpi').filter({ hasText: 'Lượt tương tác' })).toContainText('1.739');

  await expect(page.getByRole('heading', { name: 'Người hoạt động theo ngày' })).toBeVisible();
  await page.getByRole('group', { name: 'Chỉ số của biểu đồ' }).getByRole('button', { name: 'Lượt thích' }).click();
  await expect(page.getByRole('heading', { name: 'Lượt thích theo ngày' })).toBeVisible();
  await page.locator('.trend__hits button').nth(10).hover();
  await expect(page.locator('.tooltip')).toContainText('người hoạt động');

  await expect(page.locator('.heat__cell')).toHaveCount(7 * 24);
  await expect(page.getByText('cao điểm Thứ Bảy 19–20h')).toBeVisible();
  await expect(page.locator('.trendmark--new')).toHaveText('Mới');
  await expect(page.locator('.posts li').first()).toContainText('Lý Hoàng Tuấn');
  await expect(page.locator('.ranking').last()).toContainText('Trần Thu Hà');
  await expect(page.locator('.calls')).toContainText('83%');

  await page.getByRole('group', { name: 'Kỳ thống kê' }).getByRole('button', { name: '7 ngày' }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.locator('.trend__hits button')).toHaveCount(7);
});
