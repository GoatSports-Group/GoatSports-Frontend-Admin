import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, HostListener } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { User } from '@application/dto/user/user.dto';
import { UserService } from '@presentation/services/user.service';
import { StorageService } from '@presentation/services/storage.service';
import { COUNTRIES } from '@shared/constants/countries.constant';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-edit-user-drawer',
  templateUrl: './edit-user-drawer.component.html',
  styleUrls: ['./edit-user-drawer.component.scss'],
  standalone: false
})
export class EditUserDrawerComponent implements OnChanges {
  private userAdminService = inject(UserService);
  private storageService = inject(StorageService);
  private snackBar = inject(NotifyService);

  @Input() isEditDrawerOpen = false;
  @Input() editingUser: User | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  editUsername = '';
  editFullName = '';
  editAvatarUrl = '';
  editPhone = '';
  editCountry = '';
  editGender = '';
  isSubmittingEdit = false;
  isUploadingAvatar = false;
  avatarFileToUpload: File | null = null;
  localAvatarPreviewUrl: string | null = null;

  isCountryDropdownOpen = false;
  countrySearchQuery = '';
  countries = COUNTRIES;

  get filteredCountries(): readonly any[] {
    const query = this.countrySearchQuery.toLowerCase().trim();
    if (!query) return this.countries;
    return this.countries.filter(c => c.name.toLowerCase().includes(query));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingUser'] && this.editingUser) {
      this.editUsername = this.editingUser.username || '';
      this.editFullName = this.editingUser.fullName || '';
      this.editAvatarUrl = this.editingUser.avatarUrl || '';
      this.editPhone = this.editingUser.phone || '';
      this.editCountry = this.editingUser.country || '';
      this.editGender = this.editingUser.gender || 'OTHER';
      this.avatarFileToUpload = null;
      if (this.localAvatarPreviewUrl) {
        URL.revokeObjectURL(this.localAvatarPreviewUrl);
        this.localAvatarPreviewUrl = null;
      }
    }
  }

  toggleCountryDropdown(event: Event): void {
    event.stopPropagation();
    this.isCountryDropdownOpen = !this.isCountryDropdownOpen;
  }

  selectCountry(countryName: string): void {
    this.editCountry = countryName;
    this.isCountryDropdownOpen = false;
    this.countrySearchQuery = '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.isCountryDropdownOpen = false;
  }

  getAvatarUrl(avatarUrl: string | null | undefined): string {
    if (!avatarUrl) return '';
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    return `${environment.apiUrl}/storage-service/api/v1/files/download?key=${avatarUrl}`;
  }

  getFallbackAvatar(user: User): string {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.username)}`;
  }

  onAvatarSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    this.avatarFileToUpload = file;
    if (this.localAvatarPreviewUrl) {
      URL.revokeObjectURL(this.localAvatarPreviewUrl);
    }
    this.localAvatarPreviewUrl = URL.createObjectURL(file);
  }

  submitEditUser(): void {
    if (this.isSubmittingEdit || !this.editingUser) return;

    if (!this.editUsername || !this.editUsername.trim()) {
      this.snackBar.open('Tên đăng nhập không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.editFullName || !this.editFullName.trim()) {
      this.snackBar.open('Họ tên không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.editGender) {
      this.snackBar.open('Giới tính không được để trống', 'Đóng', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    this.isSubmittingEdit = true;

    const payload: Partial<User> = {
      username: this.editUsername.trim(),
      fullName: this.editFullName.trim(),
      phone: this.editPhone.trim(),
      country: this.editCountry.trim(),
      gender: this.editGender
    };

    const updateObs$ = this.userAdminService.updateUser(this.editingUser.userId, payload);

    if (this.avatarFileToUpload) {
      const file = this.avatarFileToUpload;
      const presignedObs$ = this.storageService.getPresignedUrl(file.name, file.type, 'avatars');

      forkJoin({
        user: updateObs$,
        presigned: presignedObs$
      }).subscribe({
        next: (result) => {
          this.isSubmittingEdit = false;
          this.snackBar.open(`Cập nhật thông tin thành công!`, 'Đóng', {
            duration: 2000,
            horizontalPosition: 'end',
            verticalPosition: 'top'
          });

          this.updated.emit();
          this.close.emit();

          // BACKGROUND WORK
          const presignedInfo = result.presigned[0];
          this.storageService.uploadToPresignedUrl(presignedInfo.uploadUrl, file).pipe(
            switchMap(() => this.userAdminService.updateAvatar(result.user.userId, presignedInfo.objectKey))
          ).subscribe({
            next: () => {
              this.updated.emit();
            },
            error: (err) => {
              console.error('Background avatar upload failed:', err);
              this.snackBar.open(`Tải lên ảnh đại diện thất bại ở chế độ nền!`, 'Đóng', {
                duration: 4000,
                horizontalPosition: 'end',
                verticalPosition: 'top'
              });
            }
          });
        },
        error: (err) => {
          this.isSubmittingEdit = false;
          const msg = err.error?.message || err.error?.data || 'Cập nhật tài khoản thất bại, vui lòng thử lại!';
          this.snackBar.open(msg, 'Đóng', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top'
          });
        }
      });
    } else {
      updateObs$.subscribe({
        next: (updatedUser) => {
          this.isSubmittingEdit = false;
          this.snackBar.open(`Cập nhật tài khoản ${updatedUser.username} thành công!`, 'Đóng', {
            duration: 2000,
            horizontalPosition: 'end',
            verticalPosition: 'top'
          });

          this.updated.emit();
          this.close.emit();
        },
        error: (err) => {
          this.isSubmittingEdit = false;
          const msg = err.error?.message || err.error?.data || 'Cập nhật tài khoản thất bại, vui lòng thử lại!';
          this.snackBar.open(msg, 'Đóng', {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top'
          });
        }
      });
    }
  }
}
