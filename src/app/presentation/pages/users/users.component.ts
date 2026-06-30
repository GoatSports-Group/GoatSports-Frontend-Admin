import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { UserService } from '@presentation/services/user.service';
import { User } from '@application/dto/user/user.dto';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AssignRoleDialogComponent } from '@presentation/pages/users/assign-role-dialog/assign-role-dialog.component';
import { buildRsqlSearch } from '@shared/utils/api.helper';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  private userAdminService = inject(UserService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  users: User[] = [];
  displayedColumns: string[] = ['fullName', 'username', 'email', 'role', 'status', 'createdAt', 'actions'];

  loading = false;
  searchQuery = '';

  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.userAdminService.getUsers({
      page: this.pageIndex,
      size: this.pageSize,
      filter: buildRsqlSearch(this.searchQuery, ['fullName', 'username', 'email'])
    }).subscribe({
      next: (users) => {
        this.users = users;
        if (users.length < this.pageSize) {
          this.totalItems = this.pageIndex * this.pageSize + users.length;
        } else {
          this.totalItems = (this.pageIndex + 2) * this.pageSize;
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

  onSearch(): void {
    this.pageIndex = 0;
    this.loadUsers();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  openAssignRoleDialog(user: User): void {
    const dialogRef = this.dialog.open(AssignRoleDialogComponent, {
      width: '450px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  getFallbackAvatar(user: User): string {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.username)}`;
  }
}
