import { Component, OnInit, inject } from '@angular/core';
import { ReviewService } from '../../services/review.service';
import { Review } from '../../../domain/entities/review';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit {
  private reviewService = inject(ReviewService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  reviews: Review[] = [];
  loading = true;

  ngOnInit() {
    this.loadReviews();
  }

  loadReviews() {
    this.loading = true;
    this.reviewService.getAllReviews().subscribe({
      next: (data) => {
        this.reviews = data;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Không thể tải danh sách đánh giá!', 'Đóng', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  deleteReview(review: Review) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Xóa Đánh Giá',
        message: `Bạn có chắc muốn xóa đánh giá của "${review.userFullName}" về sân này không? Hành động này không thể hoàn tác.`,
        confirmText: 'Xác nhận xóa',
        cancelText: 'Hủy',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.reviewService.deleteReview(review.reviewId).subscribe({
          next: (success) => {
            if (success) {
              this.snackBar.open('Đã xóa đánh giá thành công!', 'Đóng', {
                duration: 3000,
                panelClass: ['snackbar-success']
              });
              this.loadReviews();
            } else {
              this.snackBar.open('Xóa đánh giá thất bại!', 'Đóng', { duration: 3000 });
            }
          }
        });
      }
    });
  }
}
