import { PAGE_SIZE } from '@shared/constants/page-size';
import { Component, OnInit, inject, ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { AssignRoleDialogComponent } from '@presentation/pages/users/assign-role-dialog/assign-role-dialog.component';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { User } from '@application/dto/user/user.dto';
import { ADMIN_STATS_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-stats.repository';
import { UserService } from '@presentation/services/user.service';
import { getDisplayAvatar, getGenderLabel, getRoleLabel } from '@shared/utils/user-display.utils';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
  standalone: false
})
export class UsersComponent implements OnInit {
  readonly getDisplayAvatar = getDisplayAvatar;
  readonly getFallbackRole = getRoleLabel;
  readonly getFallbackGender = getGenderLabel;
  @ViewChild('createUserTemplate') createUserTemplate!: TemplateRef<any>;
  @ViewChild('editUserTemplate') editUserTemplate!: TemplateRef<any>;
  @ViewChild('changePasswordTemplate') changePasswordTemplate!: TemplateRef<any>;
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private dialog = inject(MatDialog);
  private snackBar = inject(NotifyService);
  private userAdminService = inject(UserService);
  private statsRepository = inject(ADMIN_STATS_REPOSITORY_TOKEN);

  private overlayRef?: OverlayRef;

  users: User[] = [];
  loading = false;
  selectedUser: User | null = null;
  loadingDetails = false;

  // Pagination states
  totalItems = 0;
  pageSize = PAGE_SIZE.table;
  pageIndex = 0;

  // Custom filter models
  filterEmail = '';
  filterFullName = '';
  filterFromDate = '';
  filterToDate = '';

  /** So dem that tu auth-service (/admin/stats/users, COUNT o DB); null = chua tai duoc, hien "—". */
  statCards: Array<{ id: 'total' | 'unverified' | 'verified'; title: string; count: number | null; icon: string }> = [
    { id: 'total', title: 'Tổng số tài khoản', count: null, icon: 'users' },
    { id: 'unverified', title: 'Chưa xác thực', count: null, icon: 'shield-alert' },
    { id: 'verified', title: 'Đã xác thực', count: null, icon: 'check-circle' }
  ];

  isCreateDrawerOpen = false;
  isEditDrawerOpen = false;
  isPasswordDrawerOpen = false;

  editingUser: User | null = null;
  passwordEditingUser: User | null = null;

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.statCards, event.previousIndex, event.currentIndex);
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadStats();
  }

  loadUsers(): void {
    this.loading = true;

    // Build RSQL query dynamically
    const parts: string[] = [];
    if (this.filterEmail && this.filterEmail.trim()) {
      parts.push(`email ~~ '*${this.filterEmail.trim().replace(/'/g, "\\'")}*'`);
    }
    if (this.filterFullName && this.filterFullName.trim()) {
      parts.push(`fullName ~~ '*${this.filterFullName.trim().replace(/'/g, "\\'")}*'`);
    }
    if (this.filterFromDate) {
      parts.push(`createdAt >= '${this.filterFromDate}T00:00:00'`);
    }
    if (this.filterToDate) {
      parts.push(`createdAt <= '${this.filterToDate}T23:59:59'`);
    }
    const rsqlFilter = parts.join(' and ');

    this.userAdminService.getUsers({
      page: this.pageIndex,
      size: this.pageSize,
      filter: rsqlFilter
    }).subscribe({
      next: (response) => {
        if (response) {
          this.users = response.result || [];
          this.totalItems = response.meta?.total || 0;
        } else {
          this.users = [];
          this.totalItems = 0;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load users:', err);
        this.loading = false;
        this.snackBar.open('Không thể tải danh sách thành viên!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  /**
   * Truoc day tai 1000 nguoi dung de dem o client va tu "dien" 15/12/3 khi rong hoac loi.
   * Gio dem bang API thong ke: tong, ACTIVE (da xac thuc), PENDING (chua xac thuc). Loi thi hien "—".
   */
  loadStats(): void {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.statsRepository.getUserStats(iso, iso).subscribe({
      next: stats => this.setStatCounts({
        total: stats.total,
        verified: stats.byStatus['ACTIVE'] ?? 0,
        unverified: stats.byStatus['PENDING'] ?? 0
      }),
      error: () => this.setStatCounts({ total: null, verified: null, unverified: null })
    });
  }

  private setStatCounts(counts: Record<'total' | 'verified' | 'unverified', number | null>): void {
    this.statCards = this.statCards.map(card => ({ ...card, count: counts[card.id] }));
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadUsers();
  }

  resetFilters(): void {
    this.filterEmail = '';
    this.filterFullName = '';
    this.filterFromDate = '';
    this.filterToDate = '';
    this.pageIndex = 0;
    this.loadUsers();
  }

  goToPage(page: number): void {
    this.pageIndex = page;
    this.loadUsers();
  }

  onCreateUser(): void {
    this.ensureOverlayCreated();
    if (!this.overlayRef!.hasAttached()) {
      const portal = new TemplatePortal(this.createUserTemplate, this.viewContainerRef);
      this.overlayRef!.attach(portal);
    }
    setTimeout(() => {
      this.isCreateDrawerOpen = true;
    }, 15);
  }

  closeCreateDrawer(): void {
    this.isCreateDrawerOpen = false;
    setTimeout(() => {
      if (!this.isCreateDrawerOpen && this.overlayRef?.hasAttached()) {
        this.overlayRef.detach();
      }
    }, 300);
  }

  onUserCreated(): void {
    this.loadUsers();
    this.loadStats();
  }

  onUserUpdated(): void {
    this.loadUsers();
    this.loadStats();
    if (this.selectedUser?.userId) {
      this.userAdminService.getUserById(this.selectedUser.userId).subscribe(user => {
        this.selectedUser = user;
      });
    }
  }

  viewUser(user: User): void {
    if (!user.userId) return;
    this.loadingDetails = true;
    this.userAdminService.getUserById(user.userId).subscribe({
      next: (detailedUser) => {
        this.loadingDetails = false;
        this.selectedUser = detailedUser;
      },
      error: (err) => {
        this.loadingDetails = false;
        this.selectedUser = user;
        console.error('Failed to load detailed user:', err);
      }
    });
  }

  closeUserDetails(): void {
    this.selectedUser = null;
  }

  editUser(user: User): void {
    this.editingUser = user;
    this.ensureOverlayCreated();
    if (this.overlayRef!.hasAttached()) {
      this.overlayRef!.detach();
    }
    const portal = new TemplatePortal(this.editUserTemplate, this.viewContainerRef);
    this.overlayRef!.attach(portal);
    setTimeout(() => {
      this.isEditDrawerOpen = true;
    }, 15);
  }

  closeEditDrawer(): void {
    this.isEditDrawerOpen = false;
    setTimeout(() => {
      if (!this.isEditDrawerOpen && this.overlayRef?.hasAttached()) {
        this.overlayRef.detach();
      }
      this.editingUser = null;
    }, 300);
  }

  openAssignRoleDialog(user: User): void {
    const dialogRef = this.dialog.open(AssignRoleDialogComponent, {
      width: '450px',
      data: { user },
      panelClass: 'custom-assign-role-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.onUserUpdated();
      }
    });
  }

  changePassword(user: User): void {
    this.passwordEditingUser = user;
    this.ensureOverlayCreated();
    if (this.overlayRef!.hasAttached()) {
      this.overlayRef!.detach();
    }
    const portal = new TemplatePortal(this.changePasswordTemplate, this.viewContainerRef);
    this.overlayRef!.attach(portal);
    setTimeout(() => {
      this.isPasswordDrawerOpen = true;
    }, 15);
  }

  closePasswordDrawer(): void {
    this.isPasswordDrawerOpen = false;
    setTimeout(() => {
      if (!this.isPasswordDrawerOpen && this.overlayRef?.hasAttached()) {
        this.overlayRef.detach();
      }
      this.passwordEditingUser = null;
    }, 300);
  }

  /** Khóa: người đó không đăng nhập được và phiên hiện tại hết hiệu lực khi access token hết hạn (vài phút). */
  changeStatus(user: User, status: 'ACTIVE' | 'BLOCKED'): void {
    if (!user.userId) return;
    const name = user.fullName || user.username;
    const blocking = status === 'BLOCKED';
    const data: ConfirmDialogData = {
      title: blocking ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?',
      message: blocking
        ? `${name} sẽ không đăng nhập được nữa và bị đăng xuất khỏi mọi thiết bị trong vài phút. Dữ liệu của tài khoản được giữ nguyên.`
        : `${name} sẽ đăng nhập và sử dụng lại được như bình thường.`,
      confirmText: blocking ? 'Khóa tài khoản' : 'Mở khóa',
      cancelText: 'Hủy',
      confirmColor: blocking ? 'warn' : 'primary'
    };
    this.dialog.open(ConfirmDialogComponent, { width: '450px', data, panelClass: 'custom-premium-dialog' })
      .afterClosed().subscribe(confirmed => {
        if (!confirmed) return;
        this.userAdminService.changeStatus(user.userId!, status).subscribe({
          next: () => {
            this.snackBar.open(blocking ? `Đã khóa tài khoản ${name}.` : `Đã mở khóa tài khoản ${name}.`, 'Đóng', {
              duration: 3000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-success']
            });
            this.onUserUpdated();
          },
          error: err => this.snackBar.open(err.error?.message || 'Không đổi được trạng thái tài khoản.', 'Đóng', {
            duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: ['snackbar-error']
          })
        });
      });
  }

  toggleVerification(user: User, verified: boolean): void {
    if (!user.userId) return;

    this.userAdminService.verifyUser(user.userId, verified).subscribe({
      next: () => {
        const statusMsg = verified ? 'xác thực' : 'hủy xác thực';
        this.snackBar.open(`Đã ${statusMsg} tài khoản ${user.fullName || user.username} thành công!`, 'Đóng', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-success']
        });

        this.onUserUpdated();
      },
      error: (err) => {
        const actionMsg = verified ? 'Xác thực' : 'Hủy xác thực';
        const msg = err.error?.message || err.error?.data || `${actionMsg} tài khoản thất bại, vui lòng thử lại!`;
        this.snackBar.open(msg, 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
      }
    });
  }

  private ensureOverlayCreated(): void {
    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        hasBackdrop: true,
        backdropClass: 'custom-drawer-backdrop',
        panelClass: 'custom-drawer-panel',
        positionStrategy: this.overlay.position().global().right('0').top('0').bottom('0'),
        scrollStrategy: this.overlay.scrollStrategies.block()
      });

      this.overlayRef.backdropClick().subscribe(() => {
        if (this.isCreateDrawerOpen) {
          this.closeCreateDrawer();
        } else if (this.isEditDrawerOpen) {
          this.closeEditDrawer();
        } else if (this.isPasswordDrawerOpen) {
          this.closePasswordDrawer();
        }
      });
    }
  }
}
