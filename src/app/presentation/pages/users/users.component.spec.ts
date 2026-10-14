import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { User } from '@application/dto/user/user.dto';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { UserService } from '@presentation/services/user.service';
import { RoleService } from '@presentation/services/role.service';
import { CryptoService } from '@presentation/services/crypto.service';
import { ConfirmService } from '@presentation/services/confirm.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { UsersComponent } from './users.component';

describe('UsersComponent', () => {
  const user = {
    userId: 'u-1', email: 'an@goat.vn', username: 'an', fullName: 'Nguyễn An', status: 'PENDING', gender: 'MALE',
    authProviders: [], role: { roleId: 'r-player', name: 'PLAYER' }, createdAt: '2026-09-01T08:00:00', updatedAt: '2026-09-01T08:00:00'
  } as unknown as User;
  const users = {
    getUsers: vi.fn(), getUserById: vi.fn(() => of(user)), createUser: vi.fn(() => of(user)), assignRole: vi.fn(() => of(user)),
    changeStatus: vi.fn(() => of(user)), verifyUser: vi.fn(() => of(user)), updatePasswordByAdmin: vi.fn(() => of(undefined))
  };
  const roles = {
    getRoles: vi.fn(() => of({
      result: [{ roleId: 'r-player', name: 'PLAYER', active: true }, { roleId: 'r-owner', name: 'VENUE_OWNER', active: true }],
      meta: { total: 2 }
    }))
  };
  const stats = { getUserStats: vi.fn(() => of({ total: 10, byStatus: { ACTIVE: 7, PENDING: 2, BLOCKED: 1 } })) };
  const crypto = { getPublicKey: vi.fn(() => of('key')), encrypt: vi.fn((value: string) => `enc(${value})`) };
  const confirm = { ask: vi.fn(() => of(true)) };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    users.getUsers.mockReturnValue(of({ result: [user], meta: { total: 1 } }));
    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: UserService, useValue: users },
        { provide: RoleService, useValue: roles },
        { provide: ADMIN_STATS_REPOSITORY_TOKEN, useValue: stats },
        { provide: CryptoService, useValue: crypto },
        { provide: ConfirmService, useValue: confirm },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists users with database counts and applies filters without a search button', () => {
    const fixture = create();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nguyễn An');
    expect(text).toContain('Chưa xác thực');
    expect(text).not.toContain('Tìm kiếm');

    const page = fixture.componentInstance;
    page.goToPage(3);
    page.setFilter('role', 'VENUE_OWNER');
    page.setFilter('status', 'BLOCKED');
    page.setFilter('fromDate', '2026-09-01');
    expect(users.getUsers).toHaveBeenLastCalledWith({
      page: 0, size: expect.any(Number),
      filter: "role.name : 'VENUE_OWNER' and status : 'BLOCKED' and createdAt >= '2026-09-01T00:00:00'"
    });
  });

  it('rejects a weak password before calling the API, then sends it encrypted', () => {
    const page = create().componentInstance;
    page.openCreate();
    page.patchDraft('username', 'binh');
    page.patchDraft('fullName', 'Trần Bình');
    page.patchDraft('email', 'binh@goat.vn');
    page.patchDraft('password', 'weak');
    page.createUser();
    expect(page.formError()).toContain('Mật khẩu');
    expect(users.createUser).not.toHaveBeenCalled();

    page.patchDraft('password', 'Str0ng!Pass');
    page.createUser();
    expect(users.createUser).toHaveBeenCalledWith(expect.objectContaining({ username: 'binh', password: 'enc(Str0ng!Pass)' }));
    expect(page.dialog()).toBeNull();
  });

  it('assigns a new role and locks only after confirmation', () => {
    const page = create().componentInstance;
    page.openRole(user);
    page.roleChoice.set('r-owner');
    page.assignRole();
    expect(users.assignRole).toHaveBeenCalledWith('u-1', 'r-owner');

    confirm.ask.mockReturnValueOnce(of(false));
    page.changeStatus(user, 'BLOCKED');
    expect(users.changeStatus).not.toHaveBeenCalled();
    page.changeStatus(user, 'BLOCKED');
    expect(users.changeStatus).toHaveBeenCalledWith('u-1', 'BLOCKED');
  });
});
