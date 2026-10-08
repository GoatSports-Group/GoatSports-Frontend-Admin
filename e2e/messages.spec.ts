import { expect, test } from '@playwright/test';
import { BOOKING_ROOM, BUSINESS_ROOM, OWNER_ID, SUPPORT_ROOM, mockAdminApi, mockChatApi, ok } from './fixtures/api.fixture';

// Tin nhan trong admin: chu san thay chat cong viec voi khach (san / giai / ve) + hop thu "Ho tro GOAT Sports";
// admin thay hop thu ho tro chung va co the chu dong nhan cho mot chu san tu trang Co so.

test.describe('chủ sân', () => {
  test.skip(({ isMobile }) => isMobile, 'Bố cục 3 cột chỉ trên desktop; mobile kiểm tra riêng bên dưới.');

  test('chỉ thấy chat công việc, có số chưa đọc trên menu, panel nói rõ khách đang hỏi sân nào', async ({ page }) => {
    await mockAdminApi(page, 'VENUE_OWNER');
    const { sent } = await mockChatApi(page, 'VENUE_OWNER');
    let types: string | null = null;
    page.on('request', request => {
      if (request.url().includes('/social/conversations?')) types = new URL(request.url()).searchParams.get('types');
    });
    await page.goto('/admin/messages');

    await expect(page.getByRole('link', { name: 'Tin nhắn' })).toContainText('2');
    expect(types).toBe('BUSINESS,SUPPORT');
    const rooms = page.getByRole('complementary', { name: 'Danh sách cuộc trò chuyện' });
    await expect(rooms.getByRole('button', { name: /Hỗ trợ GOAT Sports/ })).toBeVisible();
    await expect(rooms.getByRole('button', { name: /Nguyễn Minh Anh\s*Sân/ })).toBeVisible();
    await expect(rooms.getByRole('button', { name: /Nguyễn Minh Anh\s*Vé/ })).toBeVisible();

    // Doan chat dau tien tu mo, mo tai tin chua doc dau tien.
    await expect(page.getByRole('separator').filter({ hasText: 'Tin nhắn chưa đọc' })).toBeVisible();
    await page.getByRole('button', { name: 'Thông tin cuộc trò chuyện' }).click();
    const context = page.getByRole('complementary', { name: 'Thông tin cuộc trò chuyện' });
    await expect(context.getByRole('link', { name: /Cơ sở\s*GOAT Arena Thủ Đức/ })).toHaveAttribute('href', '/admin/venues');

    await page.getByRole('textbox', { name: 'Nội dung tin nhắn' }).fill('Tối thứ Bảy còn sân 2 bạn nhé');
    await page.keyboard.press('Enter');
    await expect(page.locator('.msg--mine .bubble').last()).toHaveText('Tối thứ Bảy còn sân 2 bạn nhé');
    // Bong bong tam hien truoc khi POST toi server: cho request that.
    await expect.poll(() => sent.length).toBe(1);
    expect((sent[0] as { content: string }).content).toBe('Tối thứ Bảy còn sân 2 bạn nhé');
  });

  test('chưa có hộp thư hỗ trợ: bấm hàng ghim để tạo và mở cuộc trò chuyện với đội quản trị', async ({ page }) => {
    await mockAdminApi(page, 'VENUE_OWNER');
    await mockChatApi(page, 'VENUE_OWNER');
    let opened = 0;
    await page.route(url => url.pathname.endsWith('/social/conversations/support'), route => {
      opened++;
      return route.fulfill(ok({
        conversationId: SUPPORT_ROOM, type: 'SUPPORT', name: 'Hỗ trợ GOAT Sports', unreadCount: 0, awaitingReply: false,
        members: [{ userId: OWNER_ID, role: 'OWNER' }], createdAt: '2026-10-08T08:00:00', updatedAt: '2026-10-08T08:00:00'
      }));
    });
    await page.goto(`/admin/messages?room=${BOOKING_ROOM}`);
    await page.getByRole('button', { name: /Hỗ trợ GOAT Sports.*Nhắn cho đội quản trị/ }).click();

    await expect(page.getByRole('heading', { name: 'Hỗ trợ GOAT Sports', level: 2 })).toBeVisible();
    await expect(page.getByText('Đội quản trị GOAT Sports').first()).toBeVisible();
    expect(opened).toBe(1);
    await expect(page).toHaveURL(new RegExp(`room=${SUPPORT_ROOM}`));
  });
});

test.describe('quản trị viên', () => {
  test.skip(({ isMobile }) => isMobile, 'Bố cục 3 cột chỉ trên desktop.');

  test('hộp thư hỗ trợ: đánh dấu "Chờ trả lời", lọc theo trạng thái, nhãn người gửi là chủ sân', async ({ page }) => {
    await mockAdminApi(page, 'ADMIN');
    await mockChatApi(page, 'ADMIN');
    await page.goto('/admin/messages');

    await expect(page.getByRole('link', { name: 'Tin nhắn' })).toContainText('1');
    const rooms = page.getByRole('complementary', { name: 'Danh sách cuộc trò chuyện' });
    await expect(rooms.getByRole('button', { name: /Phạm Chủ Sân.*Chờ trả lời/ })).toBeVisible();
    await rooms.getByRole('tab', { name: 'Chờ trả lời' }).click();
    await expect(rooms.locator('.room')).toHaveCount(1);
    await expect(page.locator('.msg__sender').first()).toHaveText('Phạm Chủ Sân');
  });

  test('"Nhắn chủ sân" ở trang Cơ sở mở hộp thư hỗ trợ của chủ sân đó', async ({ page }) => {
    await mockAdminApi(page, 'ADMIN');
    await mockChatApi(page, 'ADMIN');
    const owners: (string | null)[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().includes('/social/conversations/support')) owners.push(new URL(request.url()).searchParams.get('ownerId'));
    });
    await page.route(url => url.pathname.endsWith('/admin/venues'), route => route.fulfill(ok({
      items: [{ venueId: 'v1', ownerId: OWNER_ID, name: 'GOAT Arena Thủ Đức', active: true, district: 'Thủ Đức', city: 'TP. Hồ Chí Minh', imageUrls: [], amenities: [], courts: [] }],
      total: 1
    })));
    await page.goto('/admin/platform-venues');
    await page.getByRole('link', { name: 'Nhắn chủ sân của GOAT Arena Thủ Đức' }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/messages\\?room=${SUPPORT_ROOM}`));
    expect(owners).toContain(OWNER_ID);
    await expect(page.getByRole('heading', { name: 'Phạm Chủ Sân', level: 2 })).toBeVisible();
  });
});

test('điện thoại: danh sách trước, mở cuộc trò chuyện thì có nút quay lại', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Chỉ kiểm tra bố cục một ngăn trên điện thoại.');
  await mockAdminApi(page, 'VENUE_OWNER');
  await mockChatApi(page, 'VENUE_OWNER');
  await page.goto('/admin/messages');

  const rooms = page.getByRole('complementary', { name: 'Danh sách cuộc trò chuyện' });
  await expect(rooms).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' })).toBeHidden();
  await rooms.getByRole('button', { name: /Nguyễn Minh Anh\s*Sân/ }).click();
  await expect(page).toHaveURL(new RegExp(`room=${BUSINESS_ROOM}`));
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click();
  await expect(rooms).toBeVisible();
  // Khong tran ngang.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('đang nhập realtime: gõ thì báo cho người kia, người kia gõ thì hiện bong bóng "đang nhập"', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Logic giống nhau trên mọi kích thước; chỉ chạy desktop.');
  await mockAdminApi(page, 'VENUE_OWNER');
  await mockChatApi(page, 'VENUE_OWNER');
  const sentFrames: string[] = [];
  let pushTyping: (typing: boolean) => void = () => undefined;
  await page.routeWebSocket(/social-service\/ws$/, ws => {
    ws.onMessage(raw => {
      const message = String(raw);
      sentFrames.push(message);
      if (message.startsWith('CONNECT')) ws.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
    });
    pushTyping = typing => ws.send(`MESSAGE\ndestination:/topic/conversations/${BUSINESS_ROOM}/typing\nsubscription:typing-${BUSINESS_ROOM}\n\n${JSON.stringify({ userId: 'c0000000-0000-4000-8000-000000000003', typing })}\0`);
  });
  await page.goto('/admin/messages');
  await expect(page.getByRole('heading', { name: 'Nguyễn Minh Anh', level: 2 })).toBeVisible();
  await expect.poll(() => sentFrames.some(frame => frame.includes(`destination:/topic/conversations/${BUSINESS_ROOM}/typing`))).toBe(true);

  await page.getByRole('textbox', { name: 'Nội dung tin nhắn' }).pressSequentially('Chào');
  await expect.poll(() => sentFrames.some(frame => frame.includes('/app/social/chat.typing') && frame.includes('"typing":true'))).toBe(true);

  pushTyping(true);
  await expect(page.getByRole('status', { name: 'Minh Anh đang nhập' })).toBeVisible();
  await expect(page.locator('.room__preview--typing')).toBeVisible();
  pushTyping(false);
  await expect(page.getByRole('status', { name: 'Minh Anh đang nhập' })).toHaveCount(0);
});
