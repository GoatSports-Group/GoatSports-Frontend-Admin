import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLucideIcons } from '@lucide/angular';
import { APP_ICONS } from '../../../app-icons';
import { Role } from '@application/dto/role/role.dto';
import { Permission } from '@application/dto/permission/permission.dto';
import { RoleService } from '@presentation/services/role.service';
import { PermissionService } from '@presentation/services/permission.service';
import { ConfirmService } from '@presentation/services/confirm.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { RolesComponent } from './roles.component';

describe('RolesComponent', () => {
  const permissions: Permission[] = [
    { permissionId: 'p-1', name: 'Xem người dùng', apiPath: '/users', method: 'GET', module: 'USERS' },
    { permissionId: 'p-2', name: 'Khóa người dùng', apiPath: '/users/{id}/status', method: 'PUT', module: 'USERS' },
    { permissionId: 'p-3', name: 'Xem log', apiPath: '/logs', method: 'GET', module: 'AUDIT' }
  ];
  const support: Role = { roleId: 'r-support', name: 'SUPPORT', description: 'Hỗ trợ', active: true, permissions: [permissions[0]] };
  const player: Role = { roleId: 'r-player', name: 'PLAYER', active: true, permissions: [] };
  const roles = {
    getRoles: vi.fn(), createRole: vi.fn(() => of(support)), updateRole: vi.fn(() => of(support)),
    deleteRole: vi.fn(() => of(undefined)), activateRole: vi.fn(() => of(support)), deactivateRole: vi.fn(() => of(support))
  };
  const permissionService = { getPermissions: vi.fn(() => of({ result: permissions, meta: { total: 3 } })) };
  const confirm = { ask: vi.fn(() => of(true)) };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    roles.getRoles.mockReturnValue(of({ result: [support, player], meta: { total: 2 } }));
    await TestBed.configureTestingModule({
      imports: [RolesComponent],
      providers: [
        provideLucideIcons(...APP_ICONS),
        { provide: RoleService, useValue: roles },
        { provide: PermissionService, useValue: permissionService },
        { provide: ConfirmService, useValue: confirm },
        { provide: NotifyService, useValue: notify }
      ]
    }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(RolesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists roles, filters by status from page one and never deletes a system role', () => {
    const fixture = create();
    const page = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('SUPPORT');

    page.goToPage(2);
    page.setActive('false');
    expect(roles.getRoles).toHaveBeenLastCalledWith({ page: 0, size: expect.any(Number), filter: 'active : false' });

    page.deleteRole(player);
    expect(confirm.ask).not.toHaveBeenCalled();
    page.deleteRole(support);
    expect(roles.deleteRole).toHaveBeenCalledWith('r-support');
  });

  it('normalises a new role name and keeps permissions when editing', () => {
    const page = create().componentInstance;
    page.openForm();
    page.patchForm('name', 'bad name!');
    page.saveForm();
    expect(page.formError()).toContain('chữ in hoa');

    page.patchForm('name', 'support staff');
    page.saveForm();
    expect(roles.createRole).toHaveBeenCalledWith({ name: 'SUPPORT_STAFF', description: '' });

    page.openForm(support);
    page.patchForm('description', 'Chăm sóc khách');
    page.saveForm();
    expect(roles.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'r-support', description: 'Chăm sóc khách', permissionIds: ['p-1'] }));
  });

  it('toggles a whole module and saves the chosen permission ids', () => {
    const page = create().componentInstance;
    page.openPermissions(support);
    const users = page.groups().find(group => group.module === 'USERS')!;
    expect(page.groupState(users)).toBe('some');
    expect(page.permChanged()).toBe(false);

    page.toggleGroup(users);
    expect(page.groupState(users)).toBe('all');
    page.toggle('p-3');
    page.savePermissions();
    expect(roles.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ permissionIds: expect.arrayContaining(['p-1', 'p-2', 'p-3']) }));
    expect(page.permRole()).toBeNull();
  });
});
