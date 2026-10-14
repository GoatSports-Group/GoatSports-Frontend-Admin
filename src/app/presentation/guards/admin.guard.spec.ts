import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard with a custom role', () => {
  const router = { navigate: vi.fn() };
  const auth = {
    sessionReady$: new BehaviorSubject(true),
    isAuthenticated: true,
    currentUser: { role: { roleId: 'r', name: 'STAFF' }, permissions: ['GET_USERS'] }
  };

  beforeEach(() => {
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        AdminGuard,
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
        { provide: NotifyService, useValue: { open: vi.fn() } }
      ]
    });
  });

  const check = (data: Record<string, unknown>) => firstValueFrom(TestBed.inject(AdminGuard)
    .canActivate({ data } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  it('lets the role through the /admin shell instead of bouncing it forever', async () => {
    expect(await check({ allowedRoles: ['VENUE_OWNER'], allowBackOffice: true })).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sends it from a page it has no permission for to its first permitted page, which then opens', async () => {
    expect(await check({ allowedRoles: ['VENUE_OWNER'], platformRoute: '/dashboard' })).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/users']);
    expect(await check({ platformRoute: '/users' })).toBe(true);
  });
});
