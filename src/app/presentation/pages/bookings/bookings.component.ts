import { Component, OnInit, inject } from '@angular/core';
import { BookingService } from '../../services/booking.service';
import { Booking } from '../../../domain/entities/booking';
import { BookingStatus } from '../../../domain/enums/booking-status.enum';
import { SportType } from '../../../domain/enums/sport-type.enum';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-bookings',
  templateUrl: './bookings.component.html',
  styleUrls: ['./bookings.component.scss']
})
export class BookingsComponent implements OnInit {
  private bookingService = inject(BookingService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  bookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  loading = true;
  filterStatus = 'ALL';
  searchTerm = '';
  readonly BookingStatus = BookingStatus;

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    this.loading = true;
    this.bookingService.getAllBookings().subscribe({
      next: (data) => {
        this.bookings = data;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Không thể tải danh sách lịch đặt!', 'Đóng', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  applyFilters() {
    let list = this.bookings;

    // Filter by Status
    if (this.filterStatus !== 'ALL') {
      list = list.filter(b => b.status === this.filterStatus);
    }

    // Filter by Search Query (name or phone)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(b => 
        b.fullName.toLowerCase().includes(term) || 
        b.phone.includes(term) ||
        b.bookingId.toLowerCase().includes(term) ||
        b.venueName.toLowerCase().includes(term)
      );
    }

    this.filteredBookings = list;
  }

  updateStatus(booking: Booking, status: BookingStatus, actionLabel: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: `${actionLabel} Đặt Sân`,
        message: `Bạn có chắc muốn thực hiện hành động "${actionLabel}" đối với đặt sân #${booking.bookingId} tại "${booking.venueName}" không?`,
        confirmText: 'Đồng ý',
        cancelText: 'Quay lại',
        confirmColor: status === BookingStatus.CANCELLED ? 'warn' : 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.bookingService.updateBookingStatus(booking.bookingId, status).subscribe({
          next: (success) => {
            if (success) {
              this.snackBar.open(`Đã cập nhật trạng thái đặt sân sang "${actionLabel}"!`, 'Đóng', {
                duration: 3000,
                panelClass: ['snackbar-success']
              });
              this.loadBookings();
            } else {
              this.snackBar.open('Cập nhật trạng thái thất bại!', 'Đóng', { duration: 3000 });
            }
          }
        });
      }
    });
  }

  getStatusLabel(status: BookingStatus): string {
    return status;
  }

  getStatusClass(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.PENDING: return 'status-badge status-pending';
      case BookingStatus.CONFIRMED: return 'status-badge status-confirmed';
      case BookingStatus.COMPLETED: return 'status-badge status-completed';
      case BookingStatus.CANCELLED: return 'status-badge status-cancelled';
      default: return 'status-badge';
    }
  }

  getSportTypeLabel(type: string): string {
    switch (type) {
      case 'soccer': return SportType.SOCCER;
      case 'badminton': return SportType.BADMINTON;
      case 'tennis': return SportType.TENNIS;
      case 'pickleball': return SportType.PICKLEBALL;
      case 'basketball': return SportType.BASKETBALL;
      case 'volleyball': return SportType.VOLLEYBALL;
      default: return type;
    }
  }
}
