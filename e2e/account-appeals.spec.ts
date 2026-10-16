import { expect, Page, test } from '@playwright/test';
import { mockAdminApi } from './fixtures/api.fixture';

// Hộp thư khiếu nại: đọc thư của tài khoản bị khóa như email, mở khóa ngay tại thư, trả lời qua email.

const USER_ID = 'u0000000-0000-4000-8000-000000000777';
const APPEAL_ID = 'a0000000-0000-4000-8000-000000000001';

function appeal(status: 'NEW' | 'READ' | 'RESOLVED', extra: Record<string, unknown> = {}) {
  return {
    appealId: APPEAL_ID, userId: USER_ID, email: 'bi.khoa@goat.test', fullName: 'Người Bị Khóa',
    subject: 'Yêu cầu mở khóa tài khoản', message: 'Tôi bị khóa nhầm.\nXin xem xét lại giúp tôi.',
    status, createdAt: '2026-10-16T09:30:00', readAt: null, resolvedAt: null, reply: null, repliedAt: null,
    repliedBy: null, accountStatus: null, ...extra
  };
}

// Chỉ khớp API của auth-service: đường dẫn trang admin cũng là /admin/account-appeals.
const API = '/auth-service/api/v1/admin/account-appeals';

async function mockAppeals(page: Page) {
  const calls = { unblock: 0, replies: [] as unknown[] };
  let current = appeal('NEW');
  await page.route(url => url.pathname === `${API}/unread-count`,
    route => route.fulfill({ json: { statusCode: 200, data: { count: current.status === 'NEW' ? 1 : 0 } } }));
  await page.route(url => url.pathname === API, route => route.fulfill({
    json: { statusCode: 200, data: { meta: { page: 1, pageSize: 20, pages: 1, total: 1 }, result: [current] } }
  }));
  await page.route(url => url.pathname === `${API}/${APPEAL_ID}`, route => {
    current = appeal('READ', { readAt: '2026-10-16T10:00:00', accountStatus: 'BLOCKED' });
    return route.fulfill({ json: { statusCode: 200, data: current } });
  });
  await page.route(url => url.pathname === `${API}/${APPEAL_ID}/reply`, route => {
    calls.replies.push(route.request().postDataJSON());
    current = appeal('RESOLVED', { reply: 'Đã mở khóa cho bạn.', repliedAt: '2026-10-16T10:05:00' });
    return route.fulfill({ json: { statusCode: 200, data: current } });
  });
  await page.route(url => url.pathname.endsWith(`/admin/users/${USER_ID}/status`), route => {
    calls.unblock++;
    return route.fulfill({ json: { statusCode: 200, data: null } });
  });
  return calls;
}

test('hộp thư khiếu nại: mở thư, mở khóa tài khoản, trả lời và đánh dấu đã xử lý', async ({ page }) => {
  await mockAdminApi(page, 'ADMIN');
  const calls = await mockAppeals(page);
  await page.goto('/admin/account-appeals');

  await expect(page.getByRole('heading', { name: 'Hộp thư khiếu nại', level: 1 })).toBeVisible();
  const row = page.locator('.mail-row').first();
  await expect(row).toHaveClass(/is-unread/);
  await expect(row).toContainText('Người Bị Khóa');
  await row.click();

  const reader = page.locator('.mailbox__reader');
  await expect(reader.getByRole('heading', { name: 'Yêu cầu mở khóa tài khoản' })).toBeVisible();
  await expect(reader).toContainText('Xin xem xét lại giúp tôi.');
  await expect(reader).toContainText('Đang bị khóa');

  await reader.getByRole('button', { name: 'Mở khóa tài khoản' }).click();
  await page.getByRole('button', { name: 'Mở khóa', exact: true }).click();
  await expect(reader).toContainText('Đã mở khóa');
  await expect.poll(() => calls.unblock).toBe(1);
  // Mở khóa xong thì gợi sẵn câu báo cho người dùng.
  await expect(reader.locator('textarea')).toHaveValue(/đã được mở khóa/);

  await reader.getByRole('button', { name: 'Gửi phản hồi' }).click();
  await expect.poll(() => calls.replies.length).toBe(1);
  expect(calls.replies[0]).toMatchObject({ resolve: true });
  await expect(page.getByRole('status')).toContainText('Đã gửi phản hồi tới bi.khoa@goat.test');
});

test('sidebar báo số thư khiếu nại chưa đọc', async ({ page }) => {
  await mockAdminApi(page, 'ADMIN');
  await mockAppeals(page);
  await page.goto('/admin/account-appeals');
  await expect(page.locator('a[href="/admin/account-appeals"] .sidebar-badge')).toHaveText('1');
});
