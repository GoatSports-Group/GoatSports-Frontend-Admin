import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { BROADCAST_REPOSITORY_TOKEN, Broadcast } from '@application/ports/persistence/broadcast.repository';
import { BroadcastsComponent } from './broadcasts.component';

describe('BroadcastsComponent', () => {
  const sent: Broadcast = {
    broadcastId: 'b-1', title: 'Bảo trì', content: 'Tối nay 23:00', audience: 'VENUE_OWNER', status: 'SENT', sentBy: 'admin',
    deliveredCount: 12, failureReason: null, createdAt: '2026-10-10T09:00:00', completedAt: '2026-10-10T09:00:05'
  };
  const repository = { send: vi.fn(), list: vi.fn(), countAudience: vi.fn() };

  beforeEach(async () => {
    repository.list.mockReset().mockReturnValue(of({ items: [sent], total: 1 }));
    repository.countAudience.mockReset().mockReturnValue(of(12));
    repository.send.mockReset().mockReturnValue(of({ ...sent, status: 'SENDING', deliveredCount: 0 }));
    await TestBed.configureTestingModule({
      imports: [BroadcastsComponent],
      providers: [provideLucideIcons(...APP_ICONS), { provide: BROADCAST_REPOSITORY_TOKEN, useValue: repository }]
    }).compileComponents();
  });

  it('counts the chosen audience and only sends after confirmation', () => {
    const fixture = TestBed.createComponent(BroadcastsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(repository.countAudience).not.toHaveBeenCalled();

    page.openCompose();
    page.setAudience('VENUE_OWNER');
    expect(repository.countAudience).toHaveBeenLastCalledWith('VENUE_OWNER');
    page.openConfirm();
    expect(page.confirming()).toBe(false);

    page.title.set('  Bảo trì  ');
    page.content.set(' Tối nay 23:00 ');
    page.openConfirm();
    fixture.detectChanges();
    expect(page.confirming()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('12 tài khoản sẽ nhận');
    expect(repository.send).not.toHaveBeenCalled();

    page.send();

    expect(repository.send).toHaveBeenCalledWith({ title: 'Bảo trì', content: 'Tối nay 23:00', audience: 'VENUE_OWNER' }, expect.any(String));
    expect(page.confirming()).toBe(false);
    expect(page.composing()).toBe(false);
    expect(page.title()).toBe('');
  });

  it('retries a failed send with the same idempotency key and uses a new key for the next message', () => {
    const fixture = TestBed.createComponent(BroadcastsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.title.set('Bảo trì');
    page.content.set('Tối nay');

    repository.send.mockReturnValueOnce(throwError(() => ({ error: { message: 'Mạng lỗi' } })));
    page.send();
    expect(page.sendError()).toBe('Mạng lỗi');
    page.send();
    const [firstKey, retryKey] = repository.send.mock.calls.map(call => call[1]);
    expect(retryKey).toBe(firstKey);

    page.title.set('Thông báo khác');
    page.content.set('Nội dung khác');
    page.send();
    expect(repository.send.mock.calls[2][1]).not.toBe(firstKey);
  });

  it('rejects an over-long title', () => {
    const fixture = TestBed.createComponent(BroadcastsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.title.set('x'.repeat(151));
    page.content.set('Nội dung');

    expect(page.valid()).toBe(false);
  });
});
