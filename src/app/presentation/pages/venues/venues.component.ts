import { Component, OnInit, inject } from '@angular/core';
import { VenueService } from '@presentation/services/venue.service';
import { Venue, SportType, VenueStatus } from '@application/dto/venue/venue.dto';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-venues',
  templateUrl: './venues.component.html',
  styleUrls: ['./venues.component.scss']
})
export class VenuesComponent implements OnInit {
  private venueService = inject(VenueService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly SportType = SportType;
  readonly VenueStatus = VenueStatus;

  venues: Venue[] = [];
  loading = true;

  // Form State
  showForm = false;
  isEditMode = false;
  formVenue: Partial<Venue> = this.getEmptyVenue();
  formFacilities = '';

  ngOnInit() {
    this.loadVenues();
  }

  loadVenues() {
    this.loading = true;
    this.venueService.getVenues().subscribe({
      next: (data) => {
        this.venues = data;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Không thể tải danh sách sân!', 'Đóng', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getEmptyVenue(): Partial<Venue> {
    return {
      name: '',
      description: '',
      sportType: SportType.SOCCER,
      address: '',
      pricePerHour: 100000,
      imageUrl: 'https://images.unsplash.com/photo-1542652694-40abf526446e?w=800&q=80',
      images: ['https://images.unsplash.com/photo-1542652694-40abf526446e?w=800&q=80'],
      facilities: [],
      openingHours: '06:00 - 22:00',
      status: VenueStatus.AVAILABLE
    };
  }

  openAddForm() {
    this.isEditMode = false;
    this.formVenue = this.getEmptyVenue();
    this.formFacilities = '';
    this.showForm = true;
  }

  openEditForm(venue: Venue) {
    this.isEditMode = true;
    this.formVenue = { ...venue };
    this.formFacilities = venue.facilities.join(', ');
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.formVenue = this.getEmptyVenue();
    this.formFacilities = '';
  }

  saveVenue() {
    if (!this.formVenue.name || !this.formVenue.address || !this.formVenue.pricePerHour) {
      this.snackBar.open('Vui lòng điền đầy đủ các thông tin bắt buộc!', 'Đóng', { duration: 3000 });
      return;
    }

    // Convert facilities string to string array
    const facs = this.formFacilities
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);
    this.formVenue.facilities = facs;

    if (this.isEditMode) {
      this.venueService.updateVenue(this.formVenue as Venue).subscribe({
        next: () => {
          this.snackBar.open('Đã cập nhật thông tin sân thành công!', 'Đóng', {
            duration: 3000,
            panelClass: ['snackbar-success']
          });
          this.loadVenues();
          this.closeForm();
        }
      });
    } else {
      this.venueService.addVenue(this.formVenue as Omit<Venue, 'venueId' | 'rating'>).subscribe({
        next: () => {
          this.snackBar.open('Đã thêm sân thể thao mới thành công!', 'Đóng', {
            duration: 3000,
            panelClass: ['snackbar-success']
          });
          this.loadVenues();
          this.closeForm();
        }
      });
    }
  }

  deleteVenue(venue: Venue) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Xóa Sân Thể Thao',
        message: `Bạn có chắc chắn muốn xóa sân "${venue.name}" khỏi hệ thống không? Dữ liệu lịch đặt và review liên quan sẽ bị ảnh hưởng.`,
        confirmText: 'Xác nhận xóa',
        cancelText: 'Hủy',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.venueService.deleteVenue(venue.venueId).subscribe({
          next: (success) => {
            if (success) {
              this.snackBar.open('Đã xóa sân thành công!', 'Đóng', {
                duration: 3000,
                panelClass: ['snackbar-success']
              });
              this.loadVenues();
            } else {
              this.snackBar.open('Xóa sân thất bại!', 'Đóng', { duration: 3000 });
            }
          }
        });
      }
    });
  }

  getSportTypeLabel(type: string): string {
    switch (type) {
      case 'soccer': return 'Bóng đá';
      case 'badminton': return 'Cầu lông';
      case 'tennis': return 'Tennis';
      case 'pickleball': return 'Pickleball';
      case 'basketball': return 'Bóng rổ';
      case 'volleyball': return 'Bóng chuyền';
      default: return type;
    }
  }
}
