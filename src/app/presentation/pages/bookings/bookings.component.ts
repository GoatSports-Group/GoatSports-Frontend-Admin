import { Component, OnInit, inject } from '@angular/core';
import { ADMIN_BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/admin-booking.repository';
import {
  Booking,
  BookingStatus,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS
} from '@application/dto/booking/booking.dto';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-admin-bookings',
  templateUrl: './bookings.component.html',
  styleUrls: ['./bookings.component.scss'],
  standalone: false
})
export class AdminBookingsComponent implements OnInit {
  private bookingRepo = inject(ADMIN_BOOKING_REPOSITORY_TOKEN);
  private notifyService = inject(NotifyService);

  bookings: Booking[] = [];
  loading = true;
  selectedStatus = 'ALL';
  searchQuery = '';

  selectedBooking: Booking | null = null;
  showProcessModal = false;
  processApproved = true;
  processNote = '';
  processing = false;

  statusLabels = BOOKING_STATUS_LABELS;
  statusColors = BOOKING_STATUS_COLORS;

  statusTabs = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'CHECKED_IN', label: 'Đã nhận sân' },
    { value: 'CANCELLED', label: 'Đã hủy / Yêu cầu hoàn cọc' },
    { value: 'REFUNDED', label: 'Đã hoàn tiền' }
  ];

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    this.loading = true;
    this.bookingRepo.getBookings(this.selectedStatus).subscribe({
      next: res => {
        this.bookings = res?.data || [];
        this.loading = false;
      },
      error: err => {
        console.error('Error loading admin bookings:', err);
        this.bookings = [];
        this.loading = false;
      }
    });
  }

  onTabChange(status: string): void {
    this.selectedStatus = status;
    this.loadBookings();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  openProcessModal(booking: Booking, approved: boolean): void {
    this.selectedBooking = booking;
    this.processApproved = approved;
    this.processNote = '';
    this.showProcessModal = true;
  }

  closeProcessModal(): void {
    this.showProcessModal = false;
    this.selectedBooking = null;
  }

  submitProcess(): void {
    if (!this.selectedBooking) return;

    this.processing = true;
    this.bookingRepo.processCancellation(this.selectedBooking.bookingId, {
      approved: this.processApproved,
      processNote: this.processNote
    }).subscribe({
      next: res => {
        this.processing = false;
        this.showProcessModal = false;
        this.notifyService.success(
          this.processApproved
            ? 'Đã chấp thuận hoàn cọc cho khách hàng.'
            : 'Đã từ chối yêu cầu hủy sân.'
        );
        this.loadBookings();
      },
      error: (err: any) => {
        this.processing = false;
        const msg = err?.error?.message || 'Có lỗi xảy ra trong quá trình xử lý.';
        this.notifyService.error(msg);
      }
    });
  }
}
