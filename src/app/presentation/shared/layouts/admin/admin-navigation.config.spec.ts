import { describe, expect, it } from 'vitest';
import { PLATFORM_ADMIN_NAVIGATION, canOpenPlatformItem, isBackOfficeRole, platformNavigationItem } from './admin-navigation.config';

const item = (route: string) => platformNavigationItem(route)!;

describe('platform page access', () => {
  it('lets ADMIN open every platform page, including admin-only ones', () => {
    expect(PLATFORM_ADMIN_NAVIGATION.every(entry => canOpenPlatformItem(entry, 'ADMIN', []))).toBe(true);
  });

  it('opens only the pages a custom role holds the permission for', () => {
    const perms = ['GET_USERS', 'MODERATE_SOCIAL_CONTENT'];
    const open = PLATFORM_ADMIN_NAVIGATION.filter(entry => canOpenPlatformItem(entry, 'SUPPORT_STAFF', perms))
      .map(entry => entry.route);

    // Thông báo không cần quyền; Tin nhắn chỉ ADMIN vì backend kiểm tên vai trò.
    expect(open).toEqual(['/users', '/moderation', '/notifications']);
    expect(canOpenPlatformItem(item('/messages'), 'SUPPORT_STAFF', ['GET_USERS'])).toBe(false);
  });

  it('never opens platform pages for players or venue owners', () => {
    expect(isBackOfficeRole('PLAYER')).toBe(false);
    expect(isBackOfficeRole('venue_owner')).toBe(false);
    expect(isBackOfficeRole('')).toBe(false);
    expect(canOpenPlatformItem(item('/notifications'), 'VENUE_OWNER', [])).toBe(false);
    expect(canOpenPlatformItem(item('/users'), 'PLAYER', ['GET_USERS'])).toBe(false);
  });
});
