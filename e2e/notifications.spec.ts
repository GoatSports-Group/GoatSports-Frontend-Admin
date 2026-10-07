import { expect, test } from '@playwright/test';
import { mockAdminApi } from './fixtures/api.fixture';

// Chuong thong bao o topbar giong ben client: cham chua doc, chi co nut "da doc", link "Xem tat ca thong bao"
// toi trang Thong bao (tab Tat ca / Chua doc, xoa co xac nhan).

test('chuông: chấm chưa đọc, đánh dấu một tin đã đọc, không có nút xóa, mở trang Thông báo', async ({ page }) => {
  await mockAdminApi(page, 'VENUE_OWNER');
  const reads: string[] = [];
  page.on('request', request => {
    if (request.method() === 'PUT' && /\/notifications\/[^/]+\/read$/.test(request.url())) reads.push(request.url());
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở thông báo' }).click();

  const panel = page.getByRole('region', { name: 'Thông báo gần đây' });
  await expect(panel.getByRole('heading', { name: 'Thông báo' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeVisible();
  await expect(panel.locator('.notification-item')).toHaveCount(2);
  await expect(panel.locator('.notification-item.is-unread')).toHaveCount(1);
  // Dropdown chi doc nhanh: khong co nut xoa (xoa o trang Thong bao).
  await expect(panel.getByRole('button', { name: 'Xóa thông báo' })).toHaveCount(0);

  await panel.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click();
  await expect(panel.locator('.notification-item.is-unread')).toHaveCount(0);
  expect(reads).toHaveLength(1);

  await panel.getByRole('link', { name: 'Xem tất cả thông báo' }).click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await expect(page.getByRole('heading', { name: 'Thông báo', level: 1 })).toBeVisible();
});

test('trang Thông báo: tab Tất cả / Chưa đọc kèm số, lọc chưa đọc gửi filter lên server, xóa có xác nhận', async ({ page }) => {
  await mockAdminApi(page, 'ADMIN');
  const filters: (string | null)[] = [];
  page.on('request', request => {
    if (request.url().includes('/notification-service/api/v1/notifications?')) filters.push(new URL(request.url()).searchParams.get('filter'));
  });
  await page.route(url => /\/notifications\/n2$/.test(url.pathname), route => route.fulfill({ json: { statusCode: 200, data: null } }));
  await page.goto('/admin/notifications');

  await expect(page.getByRole('tab', { name: /Tất cả\s*2/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Chưa đọc\s*1/ })).toBeVisible();
  await expect(page.locator('.notif-row')).toHaveCount(2);
  await expect(page.locator('.notif-row').first()).toContainText('Hồ sơ chủ sân');

  await page.getByRole('tab', { name: /Chưa đọc/ }).click();
  await expect.poll(() => filters.includes("status : 'UNREAD'")).toBe(true);

  await page.getByRole('tab', { name: /Tất cả/ }).click();
  await page.getByRole('button', { name: 'Xóa thông báo Báo cáo bài viết' }).click();
  const confirm = page.getByRole('alert').filter({ hasText: 'Xóa thông báo này?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText('Đã xóa thông báo.')).toBeVisible();
});
