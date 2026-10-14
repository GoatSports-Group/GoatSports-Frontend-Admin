import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, filter, finalize, forkJoin, switchMap } from 'rxjs';
import { Role } from '@application/dto/role/role.dto';
import { Permission } from '@application/dto/permission/permission.dto';
import { RoleService } from '@presentation/services/role.service';
import { PermissionService } from '@presentation/services/permission.service';
import { ConfirmService } from '@presentation/services/confirm.service';
import { buildRsqlSearch } from '@presentation/shared/utils/api.helper';
import { getRoleLabel } from '@shared/utils/user-display.utils';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';

/** Vai trò hệ thống: không xóa được (tài khoản đang dùng chúng và code dựa vào tên của chúng). */
const SYSTEM_ROLES = new Set(['ADMIN', 'PLAYER', 'VENUE_OWNER']);

interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

/**
 * Vai trò và quyền hạn. Danh sách lọc tự áp dụng; mỗi vai trò mở "Phân quyền" để bật / tắt quyền theo nhóm module.
 * Tạo / sửa tên mô tả trong popup; tạm ngưng / kích hoạt / xóa qua popup xác nhận chung.
 */
@Component({
  selector: 'app-roles',
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, MatMenuModule, LoadingSkeletonComponent, LucideIconComponent, PaginationComponent, SelectComponent]
})
export class RolesComponent implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly permissionService = inject(PermissionService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly roleLabel = getRoleLabel;
  readonly statusOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi trạng thái' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Tạm ngưng' }
  ];

  readonly keyword = signal('');
  readonly active = signal('');
  readonly pageIndex = signal(0);
  readonly items = signal<Role[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly counts = signal<{ total: number; active: number } | null>(null);
  readonly hasFilters = computed(() => !!(this.keyword() || this.active()));

  // Popup tạo / sửa
  readonly formOpen = signal(false);
  readonly editing = signal<Role | null>(null);
  readonly form = signal({ name: '', description: '' });
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // Popup phân quyền
  readonly permRole = signal<Role | null>(null);
  readonly allPermissions = signal<Permission[]>([]);
  readonly permLoading = signal(false);
  readonly permError = signal<string | null>(null);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly permSearch = signal('');
  readonly openModules = signal<ReadonlySet<string>>(new Set());

  /** Quyền theo module, lọc theo ô tìm (tên quyền, đường dẫn, module). */
  readonly groups = computed<PermissionGroup[]>(() => {
    const needle = this.permSearch().trim().toLowerCase();
    const map = new Map<string, Permission[]>();
    for (const permission of this.allPermissions()) {
      const haystack = `${permission.name} ${permission.apiPath} ${permission.module}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      const module = permission.module || 'Khác';
      map.set(module, [...(map.get(module) ?? []), permission]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([module, permissions]) => ({ module, permissions: permissions.sort((a, b) => a.name.localeCompare(b.name)) }));
  });
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly permChanged = computed(() => {
    const before = new Set((this.permRole()?.permissions ?? []).map(item => item.permissionId));
    const after = this.selectedIds();
    return before.size !== after.size || [...after].some(id => !before.has(id));
  });

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
    this.loadCounts();
  }

  onKeyword(value: string): void { this.search$.next(value ?? ''); }

  setActive(value: string): void {
    this.active.set(value ?? '');
    this.reload();
  }

  clearFilters(): void {
    this.keyword.set('');
    this.active.set('');
    this.reload();
  }

  goToPage(index: number): void {
    this.pageIndex.set(index);
    this.load(true);
  }

  reload(): void {
    this.pageIndex.set(0);
    this.load();
  }

  load(keepList = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    (keepList ? this.paging : this.loading).set(true);
    const parts: string[] = [];
    const search = buildRsqlSearch(this.keyword(), ['name', 'description']);
    if (search) parts.push(`(${search})`);
    if (this.active()) parts.push(`active : ${this.active()}`);
    this.request = this.roleService.getRoles({ page: this.pageIndex(), size: this.pageSize, filter: parts.join(' and ') || undefined })
      .pipe(finalize(() => { this.loading.set(false); this.paging.set(false); }), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => { this.items.set(page?.result ?? []); this.total.set(page?.meta?.total ?? 0); },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được danh sách vai trò.')
      });
  }

  /** Đếm bằng meta.total của hai truy vấn size 1 (tất cả / đang hoạt động), không tải cả danh sách. */
  loadCounts(): void {
    forkJoin({
      all: this.roleService.getRoles({ page: 0, size: 1 }),
      active: this.roleService.getRoles({ page: 0, size: 1, filter: 'active : true' })
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ all, active }) => this.counts.set({ total: all.meta?.total ?? 0, active: active.meta?.total ?? 0 }),
      error: () => this.counts.set(null)
    });
  }

  isSystem(role: Role): boolean { return SYSTEM_ROLES.has(role.name); }

  // ---- Tạo / sửa ----

  openForm(role?: Role): void {
    this.editing.set(role ?? null);
    this.form.set({ name: role?.name ?? '', description: role?.description ?? '' });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  patchForm(field: 'name' | 'description', value: string): void {
    this.form.update(current => ({ ...current, [field]: value ?? '' }));
  }

  saveForm(): void {
    const role = this.editing();
    const name = role && this.isSystem(role) ? role.name : this.form().name.trim().toUpperCase().replace(/\s+/g, '_');
    const description = this.form().description.trim();
    if (!name) { this.formError.set('Nhập tên vai trò.'); return; }
    if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(name)) {
      this.formError.set('Tên vai trò chỉ gồm chữ in hoa, số và dấu gạch dưới (vd SUPPORT_STAFF).');
      return;
    }
    const request: Observable<unknown> = role
      ? this.roleService.updateRole({
        roleId: role.roleId, name, description, active: role.active,
        permissionIds: (role.permissions ?? []).map(item => item.permissionId)
      })
      : this.roleService.createRole({ name, description });
    this.run(request, role ? `Đã cập nhật vai trò ${name}.` : `Đã tạo vai trò ${name}. Bấm "Phân quyền" để cấp quyền.`,
      'Không lưu được vai trò.', () => this.formOpen.set(false));
  }

  // ---- Trạng thái / xóa ----

  toggleActive(role: Role): void {
    const pausing = role.active;
    this.confirm.ask({
      title: pausing ? `Tạm ngưng vai trò ${role.name}?` : `Kích hoạt vai trò ${role.name}?`,
      message: pausing
        ? 'Tài khoản mang vai trò này mất các quyền của nó cho tới khi kích hoạt lại. Danh sách quyền được giữ nguyên.'
        : 'Tài khoản mang vai trò này dùng lại được các quyền đã cấp.',
      confirmText: pausing ? 'Tạm ngưng' : 'Kích hoạt', cancelText: 'Hủy', confirmColor: pausing ? 'warn' : 'primary'
    }).pipe(filter(Boolean), switchMap(() => pausing ? this.roleService.deactivateRole(role.roleId) : this.roleService.activateRole(role.roleId)),
      takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterChange(pausing ? `Đã tạm ngưng vai trò ${role.name}.` : `Đã kích hoạt vai trò ${role.name}.`),
        error: err => this.notify.error(err?.error?.message ?? 'Không đổi được trạng thái vai trò.')
      });
  }

  deleteRole(role: Role): void {
    if (this.isSystem(role)) return;
    this.confirm.ask({
      title: `Xóa vai trò ${role.name}?`,
      message: 'Vai trò và danh sách quyền của nó bị xóa hẳn, không hoàn tác được. Không xóa được nếu còn tài khoản mang vai trò này.',
      confirmText: 'Xóa vai trò', cancelText: 'Hủy', confirmColor: 'warn'
    }).pipe(filter(Boolean), switchMap(() => this.roleService.deleteRole(role.roleId)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterChange(`Đã xóa vai trò ${role.name}.`, true),
        error: err => this.notify.error(err?.error?.message ?? 'Không xóa được vai trò.')
      });
  }

  // ---- Phân quyền ----

  openPermissions(role: Role): void {
    this.permRole.set(role);
    this.selectedIds.set(new Set((role.permissions ?? []).map(item => item.permissionId)));
    this.permSearch.set('');
    this.permError.set(null);
    if (this.allPermissions().length) { this.openModules.set(new Set([this.groups()[0]?.module])); return; }
    this.permLoading.set(true);
    this.permissionService.getPermissions({ page: 0, size: 1000 })
      .pipe(finalize(() => this.permLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.allPermissions.set(page?.result ?? []);
          this.openModules.set(new Set([this.groups()[0]?.module]));
        },
        error: err => this.permError.set(err?.error?.message ?? 'Không tải được danh sách quyền.')
      });
  }

  isSelected(id: string): boolean { return this.selectedIds().has(id); }

  toggle(id: string): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  groupState(group: PermissionGroup): 'all' | 'some' | 'none' {
    const chosen = group.permissions.filter(item => this.isSelected(item.permissionId)).length;
    return chosen === 0 ? 'none' : chosen === group.permissions.length ? 'all' : 'some';
  }

  /** Bật hết nhóm nếu chưa đủ, tắt hết nếu đã đủ. */
  toggleGroup(group: PermissionGroup): void {
    const on = this.groupState(group) !== 'all';
    this.selectedIds.update(current => {
      const next = new Set(current);
      group.permissions.forEach(item => on ? next.add(item.permissionId) : next.delete(item.permissionId));
      return next;
    });
  }

  toggleModule(module: string): void {
    this.openModules.update(current => {
      const next = new Set(current);
      if (!next.delete(module)) next.add(module);
      return next;
    });
  }

  isModuleOpen(module: string): boolean { return !!this.permSearch().trim() || this.openModules().has(module); }

  savePermissions(): void {
    const role = this.permRole();
    if (!role) return;
    this.run(this.roleService.updateRole({
      roleId: role.roleId, name: role.name, description: role.description ?? '', active: role.active,
      permissionIds: [...this.selectedIds()]
    }), `Đã lưu ${this.selectedCount()} quyền cho vai trò ${role.name}. Tài khoản nhận quyền mới trong vài phút.`,
      'Không lưu được quyền.', () => this.permRole.set(null), this.permError);
  }

  @HostListener('document:keydown.escape')
  closeAll(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
    this.permRole.set(null);
  }

  private afterChange(message: string, deleted = false): void {
    this.notify.success(message);
    // Xóa dòng cuối của trang thì lùi một trang.
    if (deleted && this.items().length === 1 && this.pageIndex() > 0) this.pageIndex.update(page => page - 1);
    this.load(true);
    this.loadCounts();
  }

  private run(request: Observable<unknown>, success: string, failure: string, after: () => void,
    errorTarget = this.formError): void {
    if (this.saving()) return;
    this.saving.set(true);
    errorTarget.set(null);
    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { after(); this.afterChange(success); },
      error: err => errorTarget.set(err?.error?.message ?? failure)
    });
  }
}
