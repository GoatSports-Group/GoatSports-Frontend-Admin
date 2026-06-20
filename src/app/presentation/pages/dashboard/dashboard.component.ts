import { Component, OnInit, inject } from '@angular/core';
import { BookingService } from '@presentation/services/booking.service';
import { Booking } from '@application/dto/booking/booking.dto';
import { BookingStatus } from '@domain/enums/booking-status.enum';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-dashboard-overview',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardOverviewComponent implements OnInit {
  private bookingService = inject(BookingService);
  private snackBar = inject(MatSnackBar);

  loading = true;
  error = false;

  totalVenues = 0;
  totalBookings = 0;
  totalRevenue = 0;
  bookingsToday = 0;

  recentBookings: Booking[] = [];

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = false;

    // Load overall booking stats
    this.bookingService.getStats().subscribe({
      next: (stats) => {
        this.totalVenues = stats.totalVenues;
        this.totalBookings = stats.totalBookings;
        this.totalRevenue = stats.totalRevenue;
        this.bookingsToday = stats.bookingsToday;

        // Load recent bookings list
        this.bookingService.getAllBookings().subscribe(list => {
          this.recentBookings = list.slice(0, 5); // Take top 5
          this.loading = false;
        });
      },
      error: (err) => {
        console.error('Failed to load dashboard statistics:', err);
        this.error = true;
        this.loading = false;
        this.snackBar.open('Lỗi khi tải thông số thống kê sân!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
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
