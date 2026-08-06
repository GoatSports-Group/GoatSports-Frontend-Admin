import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Log } from '@domain/entities/log';

@Component({
  selector: 'app-log-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex-1 min-h-0 flex flex-col bg-white border border-slate-100 rounded-3xl shadow-xl">
      
      <!-- Table Wrapper -->
      <div class="flex-1 min-h-0 overflow-x-auto rounded-t-3xl scrollbar-none">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-100 text-[14px] font-bold tracking-wider text-emerald-400 bg-white">
              <th class="py-4 px-6 font-bold text-emerald-500 bg-white sticky top-0 z-20 border-b border-slate-100">Người thực hiện</th>
              <th class="py-4 px-6 font-bold text-emerald-500 bg-white sticky top-0 z-20 border-b border-slate-100">Hành động</th>
              <th class="py-4 px-6 font-bold text-emerald-500 bg-white sticky top-0 z-20 border-b border-slate-100">Địa chỉ IP</th>
              <th class="py-4 px-6 font-bold text-emerald-500 bg-white sticky top-0 z-20 border-b border-slate-100">Trạng thái</th>
              <th class="py-4 px-6 font-bold text-emerald-500 bg-white sticky top-0 z-20 border-b border-slate-100">Thời gian</th>
              <th class="py-4 px-6 font-bold text-emerald-500 text-center bg-white sticky top-0 z-20 border-b border-slate-100">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <!-- Loading State -->
            <tr *ngIf="loading">
              <td colspan="6" class="py-20 text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent"></div>
                <p class="text-sm font-semibold text-slate-400 mt-3">Đang tải danh sách nhật ký...</p>
              </td>
            </tr>

            <!-- Empty State -->
            <tr *ngIf="!loading && logs.length === 0">
              <td colspan="6" class="py-20 text-center">
                <div class="text-slate-300 text-5xl mb-4">📂</div>
                <p class="text-base font-bold text-slate-700">Không tìm thấy nhật ký nào</p>
                <p class="text-sm text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc tìm kiếm của bạn.</p>
              </td>
            </tr>

            <!-- Log Rows -->
            <ng-container *ngIf="!loading && logs.length > 0">
              <tr *ngFor="let log of logs" 
                  class="hover:bg-emerald-50/50 transition-colors">
                <!-- User ID -->
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <!-- User Avatar or Initials -->
                    <span class="text-sm font-bold" [ngClass]="log.userId === 'anonymous' ? 'text-slate-400' : 'text-slate-800'">
                      {{ log.userId === 'anonymous' ? 'Khách ẩn danh' : log.userId }}
                    </span>
                  </div>
                </td>

                <!-- Action Badge -->
                <td class="py-4 px-6">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border"
                        [ngClass]="getActionBadgeClass(log.action)">
                    {{ log.action || 'HTTP CALL' }}
                  </span>
                </td>

                <!-- IP Address -->
                <td class="py-4 px-6 text-sm font-semibold text-slate-600">
                  {{ log.ipAddress || 'unknown' }}
                </td>

                <!-- Status Code -->
                <td class="py-4 px-6">
                  <span class="inline-flex items-center justify-center w-12 py-1 rounded-xl text-xs font-black"
                        [ngClass]="getStatusClass(log.statusCode)">
                    {{ log.statusCode }}
                  </span>
                </td>

                <!-- Timestamp -->
                <td class="py-4 px-6 text-sm font-semibold text-slate-600">
                  {{ formatTimestamp(log.timestamp) }}
                </td>

                <!-- Actions -->
                <td class="py-4 px-6 text-center">
                  <div class="relative inline-block">
                    <button (mouseenter)="showTooltip($event, log.description || 'Không có mô tả chi tiết')"
                            (mouseleave)="hideTooltip()"
                            class="px-4 py-1.5 rounded-2xl text-xs font-bold text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 transition-all duration-300 shadow-sm border border-emerald-100 hover:border-emerald-600 cursor-pointer">
                      Chi tiết
                    </button>
                  </div>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>

      <!-- Pagination Bottom Bar -->
      <div *ngIf="!loading && logs.length > 0" 
           class="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-slate-100 gap-4 bg-slate-50/10">
        <span class="text-xs font-semibold text-emerald-500">
          {{ getShowingText() }}
        </span>

        <div class="flex items-center gap-2">
          <!-- Previous Button -->
          <button (click)="onPrev()" [disabled]="pageIndex === 0"
            class="px-4 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-200 rounded-full hover:bg-emerald-50 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-[0.98] cursor-pointer">
            Trước
          </button>

          <!-- Page Numbers -->
          <div class="flex gap-1">
            <button *ngFor="let page of getVisiblePages()" (click)="onGoToPage(page)"
              [class]="page === pageIndex ? 'w-8 h-8 rounded-full bg-emerald-950 text-white flex items-center justify-center font-bold text-xs transition-all cursor-pointer shadow-xs' : 'w-8 h-8 rounded-full border border-slate-200 text-slate-700 hover:bg-emerald-50 flex items-center justify-center font-bold text-xs transition-all cursor-pointer'">
              {{ page + 1 }}
            </button>
          </div>

          <!-- Next Button -->
          <button (click)="onNext()" [disabled]="(pageIndex + 1) * pageSize >= totalItems"
            class="px-4 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-200 rounded-full hover:bg-emerald-50 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-[0.98] cursor-pointer">
            Tiếp
          </button>
        </div>
      </div>
    </div>

    <!-- Absolute Tooltip relative to host -->
    <div *ngIf="activeTooltipText" 
         [style.left.px]="tooltipX"
         [style.top.px]="tooltipY"
         class="absolute -translate-x-[calc(100%-24px)] -translate-y-full -mt-2 w-72 bg-slate-950/95 backdrop-blur-md text-white text-xs rounded-xl p-3.5 shadow-2xl z-[999] pointer-events-none transition-all duration-200 border border-slate-800/80">
      <!-- Arrow -->
      <div class="absolute top-full right-6 border-4 border-transparent border-t-slate-950/95"></div>
      
      <div class="space-y-1">
        <span class="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider block text-left">Mô tả hoạt động</span>
        <p class="font-medium text-slate-100 leading-relaxed text-left break-words whitespace-pre-wrap">
          {{ activeTooltipText }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 480px;
      flex-direction: column;
      position: relative;
    }
  `]
})
export class LogTableComponent {
  @Input() logs: Log[] = [];
  @Input() loading = false;
  @Input() pageIndex = 0;
  @Input() pageSize = 10;
  @Input() totalItems = 0;

  @Output() prevPage = new EventEmitter<void>();
  @Output() nextPage = new EventEmitter<void>();
  @Output() goToPage = new EventEmitter<number>();

  activeTooltipText: string | null = null;
  tooltipX = 0;
  tooltipY = 0;

  showTooltip(event: MouseEvent, text: string): void {
    this.activeTooltipText = text;
    const button = event.currentTarget as HTMLElement;
    const host = button.closest('app-log-table') as HTMLElement;
    if (button && host) {
      const buttonRect = button.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      this.tooltipX = buttonRect.left - hostRect.left + buttonRect.width / 2;
      this.tooltipY = buttonRect.top - hostRect.top;
    }
  }

  hideTooltip(): void {
    this.activeTooltipText = null;
  }



  formatTimestamp(dateStr: string): string {
    if (!dateStr) return '';
    try {
      let cleanDateStr = dateStr;
      if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        cleanDateStr = dateStr + 'Z';
      }
      const date = new Date(cleanDateStr);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  }

  formatTimestampFull(dateStr: string): string {
    if (!dateStr) return '';
    try {
      let cleanDateStr = dateStr;
      if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        cleanDateStr = dateStr + 'Z';
      }
      const date = new Date(cleanDateStr);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return dateStr;
    }
  }

  getActionBadgeClass(action: string): string {
    if (!action) return 'bg-slate-50 text-slate-600 border-slate-200';
    const cleanAction = action.toUpperCase();
    if (cleanAction.includes('LOGIN') || cleanAction.includes('REGISTER')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (cleanAction.includes('LOGOUT') || cleanAction.includes('RESET') || cleanAction.includes('UPDATE')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (cleanAction.includes('APPROVE') || cleanAction.includes('ASSIGN')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (cleanAction.includes('ERROR') || cleanAction.includes('FAIL')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  getStatusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return 'bg-emerald-500 text-white';
    } else if (statusCode >= 300 && statusCode < 400) {
      return 'bg-blue-500 text-white';
    } else if (statusCode >= 400 && statusCode < 500) {
      return 'bg-amber-500 text-white';
    } else if (statusCode >= 500) {
      return 'bg-rose-500 text-white';
    }
    return 'bg-slate-500 text-white';
  }

  getTotalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  getShowingText(): string {
    if (this.totalItems === 0) {
      return 'Xem 0 - 0 trong 0 kết quả';
    }
    const start = this.pageIndex * this.pageSize + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.totalItems);
    return `Xem ${start} - ${end} trong ${this.totalItems} kết quả`;
  }

  getVisiblePages(): number[] {
    const totalPages = this.getTotalPages();
    const visiblePages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(0, this.pageIndex - 2);
    let end = Math.min(totalPages - 1, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(0, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      visiblePages.push(i);
    }
    return visiblePages;
  }

  onPrev(): void {
    this.prevPage.emit();
  }

  onNext(): void {
    this.nextPage.emit();
  }

  onGoToPage(page: number): void {
    this.goToPage.emit(page);
  }


}
