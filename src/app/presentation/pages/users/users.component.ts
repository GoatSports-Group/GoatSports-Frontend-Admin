import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { SERVER_MAX_PAGE_SIZE, fetchAllPages } from '@shared/utils/fetch-all-pages';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';
import { User } from '@application/dto/user/user.dto';
import { Role } from '@application/dto/role/role.dto';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { UserService } from '@presentation/services/user.service';
import { RoleService } from '@presentation/services/role.service';
import { CryptoService } from '@presentation/services/crypto.service';
import { ConfirmService } from '@presentation/services/confirm.service';
import { buildRsqlSearch } from '@presentation/shared/utils/api.helper';
import { calculatePasswordStrength } from '@presentation/shared/utils/password.utils';
import { PASSWORD_PATTERN } from '@presentation/shared/constants/password.constants';
import { getDisplayAvatar, getGenderLabel, getRoleLabel } from '@shared/utils/user-display.utils';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { DatePickerComponent } from '@shared/components/ui/date-picker/date-picker.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import { SelectComponent, SelectOption } from '@shared/components/ui/select/select.component';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary' | 'info';
type UserStatus = 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'PENDING_DELETION' | 'DELETED';
type Dialog = 'detail' | 'create' | 'password' | 'role' | null;

const STATUS_META: Readonly<Record<string, { label: string; tone: Tone }>> = {
  ACTIVE: { label: 'Đã xác thực', tone: 'success' },
  ACTIVATED: { label: 'Đã xác thực', tone: 'success' },
  PENDING: { label: 'Chưa xác thực', tone: 'warning' },
  BLOCKED: { label: 'Đã khóa', tone: 'danger' },
  PENDING_DELETION: { label: 'Chờ xóa', tone: 'warning' },
  DELETED: { label: 'Đã xóa', tone: 'neutral' }
};

const ROLE_TONE: Readonly<Record<string, Tone>> = { ADMIN: 'primary', VENUE_OWNER: 'info', PLAYER: 'neutral' };
const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Người dùng: tài khoản người chơi, chủ sân và quản trị viên. Lọc tự áp dụng (tìm, vai trò, trạng thái, ngày tham gia);
 * thao tác: xem chi tiết, gán vai trò, đổi mật khẩu, xác thực / bỏ xác thực, khóa / mở khóa. Admin không sửa hồ sơ
 * của người khác và không xuất danh sách người dùng.
 */
@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, FormsModule, MatMenuModule, DatePickerComponent, LoadingSkeletonComponent, LucideIconComponent,
    PaginationComponent, SelectComponent]
})
export class UsersComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly stats = inject(ADMIN_STATS_REPOSITORY_TOKEN);
  private readonly crypto = inject(CryptoService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();
  private request?: Subscription;

  readonly pageSize = PAGE_SIZE.table;
  readonly avatar = getDisplayAvatar;
  readonly roleLabel = getRoleLabel;
  readonly genderLabel = getGenderLabel;
  readonly genderOptions: readonly SelectOption[] = [
    { value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }
  ];
  readonly statusOptions: readonly SelectOption[] = [
    { value: '', label: 'Mọi trạng thái' }, { value: 'ACTIVE', label: 'Đã xác thực' },
    { value: 'PENDING', label: 'Chưa xác thực' }, { value: 'BLOCKED', label: 'Đã khóa' },
    { value: 'PENDING_DELETION', label: 'Chờ xóa' }, { value: 'DELETED', label: 'Đã xóa' }
  ];

  readonly keyword = signal('');
  readonly role = signal('');
  readonly status = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly pageIndex = signal(0);

  readonly items = signal<User[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly paging = signal(false);
  readonly error = signal<string | null>(null);
  readonly counts = signal<{ total: number; active: number; pending: number; blocked: number } | null>(null);
  readonly roles = signal<Role[]>([]);

  readonly roleOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Mọi vai trò' },
    ...this.roles().map(role => ({ value: role.name, label: getRoleLabel(role.name) || role.name }))
  ]);
  readonly hasFilters = computed(() => !!(this.keyword() || this.role() || this.status() || this.fromDate() || this.toDate()));

  // Popup đang mở và dữ liệu của nó.
  readonly dialog = signal<Dialog>(null);
  readonly selected = signal<User | null>(null);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly draft = signal({ username: '', fullName: '', email: '', gender: 'MALE', password: '' });
  readonly passwords = signal({ next: '', confirm: '' });
  readonly showPassword = signal(false);
  readonly roleChoice = signal('');

  readonly draftStrength = computed(() => calculatePasswordStrength(this.draft().password));
  readonly passwordStrength = computed(() => calculatePasswordStrength(this.passwords().next));

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => { this.keyword.set(value.trim()); this.reload(); });
    this.load();
    this.loadCounts();
    fetchAllPages(page => this.roleService.getRoles({ page, size: SERVER_MAX_PAGE_SIZE }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: roles => this.roles.set(roles), error: () => this.roles.set([]) });
  }

  onKeyword(value: string): void { this.search$.next(value ?? ''); }

  setFilter(which: 'role' | 'status' | 'fromDate' | 'toDate', value: string): void {
    ({ role: this.role, status: this.status, fromDate: this.fromDate, toDate: this.toDate })[which].set(value ?? '');
    this.reload();
  }

  clearFilters(): void {
    this.keyword.set('');
    this.role.set('');
    this.status.set('');
    this.fromDate.set('');
    this.toDate.set('');
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
    this.request = this.users.getUsers({ page: this.pageIndex(), size: this.pageSize, filter: this.filter() || undefined })
      .pipe(finalize(() => { this.loading.set(false); this.paging.set(false); }), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.items.set(page?.result ?? []);
          this.total.set(page?.meta?.total ?? 0);
        },
        error: err => this.error.set(err?.error?.message ?? 'Không tải được danh sách người dùng.')
      });
  }

  /** Số đếm ở DB (auth-service /admin/stats/users), không tải cả danh sách về đếm. */
  loadCounts(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.stats.getUserStats(today, today).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stats => this.counts.set({
        total: stats.total, active: stats.byStatus['ACTIVE'] ?? 0, pending: stats.byStatus['PENDING'] ?? 0,
        blocked: stats.byStatus['BLOCKED'] ?? 0
      }),
      error: () => this.counts.set(null)
    });
  }

  statusOf(user: User) { return STATUS_META[user.status] ?? { label: user.status, tone: 'neutral' as Tone }; }
  roleTone(user: User): Tone { return ROLE_TONE[user.role?.name] ?? 'neutral'; }
  isVerified(user: User): boolean { return user.status === 'ACTIVE' || user.status === 'ACTIVATED'; }
  /** Người dùng tự yêu cầu xóa (chờ 30 ngày) hoặc đã bị ẩn danh hóa: admin chỉ xem, không đổi gì. */
  isDeleting(user: User): boolean { return user.status === 'PENDING_DELETION' || user.status === 'DELETED'; }

  // ---- Popup ----

  @HostListener('document:keydown.escape')
  closeDialog(): void {
    if (this.saving()) return;
    this.dialog.set(null);
    this.formError.set(null);
  }

  openDetail(user: User): void {
    this.selected.set(user);
    this.dialog.set('detail');
    this.detailLoading.set(true);
    this.users.getUserById(user.userId).pipe(finalize(() => this.detailLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: full => this.selected.set(full), error: () => undefined });
  }

  openCreate(): void {
    this.formError.set(null);
    this.showPassword.set(false);
    this.dialog.set('create');
  }

  openPassword(user: User): void {
    this.selected.set(user);
    this.passwords.set({ next: '', confirm: '' });
    this.showPassword.set(false);
    this.formError.set(null);
    this.dialog.set('password');
  }

  openRole(user: User): void {
    this.selected.set(user);
    this.roleChoice.set(user.role?.roleId ?? '');
    this.formError.set(null);
    this.dialog.set('role');
  }

  patchDraft(field: 'username' | 'fullName' | 'email' | 'gender' | 'password', value: string): void {
    this.draft.update(draft => ({ ...draft, [field]: value ?? '' }));
  }

  patchPasswords(field: 'next' | 'confirm', value: string): void {
    this.passwords.update(current => ({ ...current, [field]: value ?? '' }));
  }

  createUser(): void {
    const draft = this.draft();
    const problem = !draft.username.trim() ? 'Nhập tên đăng nhập.'
      : !draft.fullName.trim() ? 'Nhập họ tên.'
        : !EMAIL.test(draft.email.trim()) ? 'Email không hợp lệ.'
          : !PASSWORD_PATTERN.test(draft.password) ? 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.'
            : null;
    if (problem) { this.formError.set(problem); return; }
    this.submit(this.withEncrypted(draft.password, password => this.users.createUser({
      username: draft.username.trim(), fullName: draft.fullName.trim(), email: draft.email.trim(), gender: draft.gender, password
    })), `Đã tạo tài khoản ${draft.username.trim()}.`, 'Không tạo được tài khoản.', () => {
      this.draft.set({ username: '', fullName: '', email: '', gender: 'MALE', password: '' });
      this.loadCounts();
    });
  }

  changePassword(): void {
    const user = this.selected();
    const { next, confirm } = this.passwords();
    if (!user) return;
    const problem = !PASSWORD_PATTERN.test(next) ? 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.'
      : next !== confirm ? 'Hai mật khẩu chưa khớp.' : null;
    if (problem) { this.formError.set(problem); return; }
    this.submit(this.crypto.getPublicKey().pipe(switchMap(key =>
      this.users.updatePasswordByAdmin(user.userId, this.crypto.encrypt(next, key), this.crypto.encrypt(confirm, key)))),
      `Đã đổi mật khẩu cho ${user.fullName || user.username}.`, 'Không đổi được mật khẩu.');
  }

  assignRole(): void {
    const user = this.selected();
    const roleId = this.roleChoice();
    if (!user || !roleId) return;
    if (roleId === user.role?.roleId) { this.closeDialog(); return; }
    const role = this.roles().find(item => item.roleId === roleId);
    this.submit(this.users.assignRole(user.userId, roleId),
      `${user.fullName || user.username} giờ là ${getRoleLabel(role?.name) || role?.name}.`, 'Không gán được vai trò.',
      () => this.loadCounts());
  }

  /** Khóa: không đăng nhập được, phiên hiện tại hết hiệu lực khi access token hết hạn (vài phút). */
  changeStatus(user: User, status: 'ACTIVE' | 'BLOCKED'): void {
    const name = user.fullName || user.username;
    const blocking = status === 'BLOCKED';
    this.confirm.ask({
      title: blocking ? `Khóa tài khoản ${name}?` : `Mở khóa tài khoản ${name}?`,
      message: blocking
        ? 'Người này không đăng nhập được nữa và bị đăng xuất khỏi mọi thiết bị trong vài phút. Dữ liệu được giữ nguyên.'
        : 'Người này đăng nhập và sử dụng lại được như bình thường.',
      confirmText: blocking ? 'Khóa tài khoản' : 'Mở khóa', cancelText: 'Hủy', confirmColor: blocking ? 'warn' : 'primary'
    }).pipe(filter(Boolean), switchMap(() => this.users.changeStatus(user.userId, status)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterChange(blocking ? `Đã khóa tài khoản ${name}.` : `Đã mở khóa tài khoản ${name}.`),
        error: err => this.notify.error(err?.error?.message ?? 'Không đổi được trạng thái tài khoản.')
      });
  }

  toggleVerification(user: User): void {
    const verify = !this.isVerified(user);
    const name = user.fullName || user.username;
    this.confirm.ask({
      title: verify ? `Xác thực tài khoản ${name}?` : `Bỏ xác thực tài khoản ${name}?`,
      message: verify ? 'Tài khoản được coi là đã xác minh email.' : 'Người này cần xác thực lại email trước khi dùng tiếp.',
      confirmText: verify ? 'Xác thực' : 'Bỏ xác thực', cancelText: 'Hủy', confirmColor: verify ? 'primary' : 'warn'
    }).pipe(filter(Boolean), switchMap(() => this.users.verifyUser(user.userId, verify)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterChange(verify ? `Đã xác thực ${name}.` : `Đã bỏ xác thực ${name}.`),
        error: err => this.notify.error(err?.error?.message ?? 'Không đổi được trạng thái xác thực.')
      });
  }

  private afterChange(message: string): void {
    this.notify.success(message);
    this.load(true);
    this.loadCounts();
    const open = this.selected();
    if (this.dialog() === 'detail' && open) {
      this.users.getUserById(open.userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(full => this.selected.set(full));
    }
  }

  private withEncrypted<T>(password: string, call: (encrypted: string) => Observable<T>): Observable<T> {
    return this.crypto.getPublicKey().pipe(switchMap(key => call(this.crypto.encrypt(password, key))));
  }

  private submit(request: Observable<unknown>, success: string, failure: string, after?: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialog.set(null);
        this.notify.success(success);
        this.load(true);
        after?.();
      },
      error: err => this.formError.set(err?.error?.message ?? err?.error?.data ?? failure)
    });
  }

  /** RSQL cho auth-service (springfilter): nhóm tìm kiếm trong ngoặc, rồi vai trò, trạng thái, khoảng ngày. */
  private filter(): string {
    const parts: string[] = [];
    const search = buildRsqlSearch(this.keyword(), ['fullName', 'email', 'username']);
    if (search) parts.push(`(${search})`);
    if (this.role()) parts.push(`role.name : '${this.role()}'`);
    if (this.status()) parts.push(`status : '${this.status() as UserStatus}'`);
    if (this.fromDate()) parts.push(`createdAt >= '${this.fromDate()}T00:00:00'`);
    if (this.toDate()) parts.push(`createdAt <= '${this.toDate()}T23:59:59'`);
    return parts.join(' and ');
  }
}
