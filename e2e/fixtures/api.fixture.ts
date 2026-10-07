import { Page, Route } from '@playwright/test';

// Mock toàn bộ API cho admin e2e (không cần backend). Mỗi test gọi mockAdminApi(page, 'ADMIN' | 'VENUE_OWNER'),
// rồi tự route thêm dữ liệu riêng của trang (Playwright ưu tiên route đăng ký sau).

export const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
export const OWNER_ID = 'b0000000-0000-4000-8000-000000000002';
export const PLAYER_ID = 'c0000000-0000-4000-8000-000000000003';

export type Role = 'ADMIN' | 'VENUE_OWNER';

const users: Record<string, { userId: string; email: string; username: string; fullName: string; role: string }> = {
  [ADMIN_ID]: { userId: ADMIN_ID, email: 'admin@goatsports.test', username: 'goat_admin', fullName: 'Lê Quản Trị', role: 'ADMIN' },
  [OWNER_ID]: { userId: OWNER_ID, email: 'owner@goatsports.test', username: 'goat_owner', fullName: 'Phạm Chủ Sân', role: 'VENUE_OWNER' },
  [PLAYER_ID]: { userId: PLAYER_ID, email: 'player@goatsports.test', username: 'goat_player', fullName: 'Nguyễn Minh Anh', role: 'PLAYER' }
};

export function userDto(userId: string) {
  const user = users[userId];
  return {
    userId: user.userId,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: '',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    role: { roleId: `role-${user.role}`, name: user.role }
  };
}

export const ok = (data: unknown) => ({ json: { data, statusCode: 200, message: null, error: null } });

export const springPage = (content: unknown[], size = 20) => ({
  content, totalElements: content.length, totalPages: content.length ? 1 : 0, number: 0, size,
  first: true, last: true, empty: content.length === 0, numberOfElements: content.length
});

export const listPage = (result: unknown[], pageSize = 20) => ({
  meta: { page: 1, pageSize, pages: result.length ? 1 : 0, total: result.length }, result
});

const now = Date.now();
export const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString().slice(0, 19);

export function notifications(role: Role) {
  return role === 'ADMIN'
    ? [
      { notificationId: 'n1', receiverId: ADMIN_ID, title: 'Đơn đăng ký chủ sân mới', content: 'Phạm Chủ Sân vừa gửi hồ sơ cơ sở GOAT Arena Thủ Đức.', type: 'OWNER_APPLICATION', status: 'UNREAD', createdAt: minutesAgo(12) },
      { notificationId: 'n2', receiverId: ADMIN_ID, title: 'Báo cáo bài viết', content: 'Một bài viết trong Cộng đồng bị báo cáo 3 lần.', type: 'SYSTEM', status: 'READ', createdAt: minutesAgo(60 * 26) }
    ]
    : [
      { notificationId: 'n3', receiverId: OWNER_ID, title: 'Yêu cầu đăng ký chủ sân bị từ chối', content: 'Đơn đăng ký làm chủ sân của bạn đã bị từ chối. Lý do: thiếu giấy phép kinh doanh.', type: 'OWNER_APPLICATION', status: 'UNREAD', createdAt: minutesAgo(60 * 24 * 23) },
      { notificationId: 'n4', receiverId: OWNER_ID, title: 'Yêu cầu đăng ký chủ sân được phê duyệt', content: 'Đơn đăng ký làm chủ sân của bạn đã được chấp nhận.', type: 'OWNER_APPLICATION', status: 'READ', createdAt: minutesAgo(60 * 24 * 26) }
    ];
}

/** Đăng nhập theo vai trò + các API dùng chung của shell; API chưa mock trả 404 (trang hiện trạng thái lỗi). */
export async function mockAdminApi(page: Page, role: Role = 'ADMIN'): Promise<void> {
  const me = role === 'ADMIN' ? ADMIN_ID : OWNER_ID;
  const items = notifications(role);

  // WebSocket thông báo / chat: chấp nhận kết nối và trả CONNECTED để service không thử lại liên tục.
  await page.routeWebSocket(/\/ws$/, ws => {
    ws.onMessage(message => {
      if (String(message).startsWith('CONNECT')) ws.send('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
    });
  });

  await page.route(url => url.port === '7070', (route: Route) => route.fulfill({ status: 404, json: { statusCode: 404, message: 'Chưa mock', data: null } }));

  await page.route(url => url.pathname.endsWith('/auth/refresh') || url.pathname.endsWith('/auth/me'),
    route => route.fulfill(ok(userDto(me))));
  await page.route(url => /\/auth-service\/api\/v1\/users\/[^/]+$/.test(url.pathname), route => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    return users[id] ? route.fulfill(ok(userDto(id))) : route.fulfill({ status: 404, json: { statusCode: 404, data: null } });
  });

  await page.route(url => url.pathname.endsWith('/notification-service/api/v1/notifications'),
    route => route.fulfill(ok(listPage(items, 10))));
  await page.route(url => url.pathname.endsWith('/notifications/unread-count'),
    route => route.fulfill(ok(items.filter(item => item.status === 'UNREAD').length)));
  await page.route(url => /\/notifications\/(read-all|[^/]+\/read)$/.test(url.pathname),
    route => route.fulfill(ok(null)));
}

// ---- Tin nhan -------------------------------------------------------------------------------------
export const VENUE_ID = 'v0000000-0000-4000-8000-000000000010';
export const BOOKING_ID = 'k0000000-0000-4000-8000-000000000020';
export const BUSINESS_ROOM = 'r0000000-0000-4000-8000-000000000101';
export const BOOKING_ROOM = 'r0000000-0000-4000-8000-000000000102';
export const SUPPORT_ROOM = 'r0000000-0000-4000-8000-000000000103';

export function chatRooms(role: Role) {
  const support = {
    conversationId: SUPPORT_ROOM, type: 'SUPPORT', name: 'Hỗ trợ GOAT Sports', unreadCount: role === 'ADMIN' ? 1 : 0,
    awaitingReply: true, lastMessageContent: 'Sân của tôi bị ẩn khỏi tìm kiếm, nhờ đội quản trị kiểm tra giúp.',
    lastMessageAt: minutesAgo(8), lastSenderId: OWNER_ID,
    members: [{ userId: OWNER_ID, role: 'OWNER' }, ...(role === 'ADMIN' ? [{ userId: ADMIN_ID, role: 'ADMIN' }] : [])],
    createdAt: minutesAgo(600), updatedAt: minutesAgo(8)
  };
  if (role === 'ADMIN') return [support];
  return [
    {
      conversationId: BUSINESS_ROOM, type: 'BUSINESS', subjectType: 'VENUE', subjectId: VENUE_ID, unreadCount: 2,
      lastMessageContent: 'Sân còn trống tối thứ Bảy không anh?', lastMessageAt: minutesAgo(3), lastSenderId: PLAYER_ID,
      members: [{ userId: OWNER_ID, role: 'OWNER' }, { userId: PLAYER_ID, role: 'MEMBER' }],
      createdAt: minutesAgo(3000), updatedAt: minutesAgo(3)
    },
    {
      conversationId: BOOKING_ROOM, type: 'BUSINESS', subjectType: 'BOOKING', subjectId: BOOKING_ID, unreadCount: 0,
      lastMessageContent: 'Cảm ơn anh, hẹn gặp ở sân.', lastMessageAt: minutesAgo(60 * 26), lastSenderId: OWNER_ID,
      muted: true, members: [{ userId: OWNER_ID, role: 'OWNER' }, { userId: PLAYER_ID, role: 'MEMBER' }],
      createdAt: minutesAgo(9000), updatedAt: minutesAgo(60 * 26)
    }
  ];
}

function chatMessages(roomId: string) {
  const other = roomId === SUPPORT_ROOM ? OWNER_ID : PLAYER_ID;
  const me = roomId === SUPPORT_ROOM ? ADMIN_ID : OWNER_ID;
  return [
    { messageId: `${roomId}-3`, conversationId: roomId, senderId: other, content: roomId === SUPPORT_ROOM ? 'Sân của tôi bị ẩn khỏi tìm kiếm, nhờ đội quản trị kiểm tra giúp.' : 'Sân còn trống tối thứ Bảy không anh?', type: 'TEXT', sentAt: minutesAgo(3), attachments: [] },
    { messageId: `${roomId}-2`, conversationId: roomId, senderId: other, content: 'Em muốn đặt 2 tiếng từ 19h.', type: 'TEXT', sentAt: minutesAgo(4), attachments: [] },
    { messageId: `${roomId}-1`, conversationId: roomId, senderId: me, content: 'Chào bạn, mình hỗ trợ được nhé.', type: 'TEXT', sentAt: minutesAgo(60 * 25), attachments: [] }
  ];
}

/** Mock Tin nhan: danh sach theo vai tro, tin nhan, gui tin, hop thu ho tro, san / ve cua chu san. */
export async function mockChatApi(page: Page, role: Role): Promise<{ sent: unknown[] }> {
  const sent: unknown[] = [];
  const rooms = chatRooms(role);
  await page.route(url => url.pathname.endsWith('/social/conversations') && url.searchParams.has('types'),
    route => route.fulfill(ok(springPage(rooms))));
  await page.route(url => url.pathname.endsWith('/social/conversations/support/inbox'),
    route => route.fulfill(ok(springPage(rooms))));
  await page.route(url => url.pathname.endsWith('/social/conversations/support'),
    route => route.fulfill(ok(chatRooms('ADMIN')[0])));
  await page.route(url => /\/social\/conversations\/[^/]+\/messages\/cursor$/.test(url.pathname), route => {
    const id = new URL(route.request().url()).pathname.split('/').slice(-3)[0];
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill(ok(params.has('before') || params.has('after') ? [] : chatMessages(id)));
  });
  await page.route(url => /\/social\/conversations\/[^/]+\/messages\/unread-window$/.test(url.pathname), route => {
    const id = new URL(route.request().url()).pathname.split('/').slice(-3)[0];
    const messages = chatMessages(id);
    return route.fulfill(ok({ messages, firstUnreadMessageId: messages[1].messageId, hasOlder: false, hasNewer: false }));
  });
  await page.route(url => /\/social\/conversations\/[^/]+\/messages$/.test(url.pathname), route => {
    const body = route.request().postDataJSON();
    sent.push(body);
    const id = new URL(route.request().url()).pathname.split('/').slice(-2)[0];
    return route.fulfill(ok({ messageId: `saved-${sent.length}`, conversationId: id, senderId: role === 'ADMIN' ? ADMIN_ID : OWNER_ID,
      clientMessageId: body.clientMessageId, content: body.content, type: body.type, attachments: [], sentAt: new Date().toISOString().slice(0, 19) }));
  });
  await page.route(url => /\/social\/conversations\/[^/]+\/(read|mute)$/.test(url.pathname), route => route.fulfill({ status: 204 }));
  await page.route(url => url.pathname.endsWith('/venue-service/api/v1/owner/venues'), route => route.fulfill(ok([
    { venueId: VENUE_ID, name: 'GOAT Arena Thủ Đức', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh', active: true, imageUrls: [], amenities: [], courts: [] }
  ])));
  await page.route(url => url.pathname.endsWith(`/owner/bookings/${BOOKING_ID}`), route => route.fulfill(ok({
    bookingId: BOOKING_ID, venueId: VENUE_ID, venueCourtId: 'court-1', venueName: 'GOAT Arena Thủ Đức', courtName: 'Sân cầu lông A',
    playDate: '2026-10-11', startTime: '19:00:00', endTime: '21:00:00', status: 'CONFIRMED', source: 'DIRECT',
    totalPrice: 300000, depositAmount: 90000, remainingAmount: 210000, bookingCode: 'GS123456', createdAt: minutesAgo(3000)
  })));
  return { sent };
}
