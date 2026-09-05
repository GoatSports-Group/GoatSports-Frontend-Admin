import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent implements OnChanges {
  @Input({ required: true }) pageIndex: number = 0; // 0-indexed
  @Input({ required: true }) pageSize: number = 10;
  @Input({ required: true }) totalItems: number = 0;

  @Output() pageChange = new EventEmitter<number>();

  totalPages: number = 1;
  visiblePages: (number | string)[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['totalItems'] || changes['pageSize'] || changes['pageIndex']) {
      this.calculateTotalPages();
      this.calculateVisiblePages();
    }
  }

  calculateTotalPages(): void {
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  calculateVisiblePages(): void {
    const current = this.pageIndex;
    const total = this.totalPages;
    const pages: (number | string)[] = [];

    // Always include page 0
    pages.push(0);

    let start = Math.max(1, current - 1);
    let end = Math.min(total - 2, current + 1);

    if (current <= 2) {
      end = Math.min(total - 2, 3);
    }
    if (current >= total - 3) {
      start = Math.max(1, total - 4);
    }

    if (start > 1) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < total - 2) {
      pages.push('...');
    }

    // Always include last page
    if (total > 1) {
      pages.push(total - 1);
    }

    this.visiblePages = pages;
  }

  getShowingText(): string {
    if (this.totalItems === 0) {
      return 'Hiển thị 0 - 0 trong tổng số 0 kết quả';
    }
    const start = this.pageIndex * this.pageSize + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.totalItems);
    return `Hiển thị ${start} - ${end} trong tổng số ${this.totalItems} kết quả`;
  }

  goToPage(pageIndex: number): void {
    if (pageIndex >= 0 && pageIndex < this.totalPages && pageIndex !== this.pageIndex) {
      this.pageChange.emit(pageIndex);
    }
  }

  goToFirst(): void {
    this.goToPage(0);
  }

  goToLast(): void {
    this.goToPage(this.totalPages - 1);
  }

  goToPrev(): void {
    this.goToPage(this.pageIndex - 1);
  }

  goToNext(): void {
    this.goToPage(this.pageIndex + 1);
  }
}
