import { describe, expect, it } from 'vitest';
import { Notification } from '@application/dto/notification/notification.dto';
import { notificationRoute } from './notification-view';

describe('notificationRoute', () => {
  const report = (referenceType: string) => ({ type: 'REPORT_EXPORT', referenceType, referenceId: 'e-1' }) as unknown as Notification;

  it('opens the exports list on the page that produced the report', () => {
    expect(notificationRoute(report('FINANCE_REPORT_EXPORT'), true)).toBe('/admin/platform-finance?tab=refunds&exports=open');
    expect(notificationRoute(report('REPORT_EXPORT'), true)).toBe('/admin/bookings?exports=open');
    expect(notificationRoute(report('FINANCE_REPORT_EXPORT'), false)).toBeNull();
  });

  it('sends operational alerts to the page that explains them', () => {
    const alert = (referenceType: string) => ({ type: 'SYSTEM', referenceType, referenceId: 'x' }) as unknown as Notification;
    expect(notificationRoute(alert('SYSTEM_ALERT'), true)).toBe('/admin/system');
    expect(notificationRoute(alert('SECURITY_ALERT'), true)).toBe('/admin/logs?alerts=open');
    expect(notificationRoute(alert('SYSTEM_ALERT'), false)).toBeNull();
  });
});
