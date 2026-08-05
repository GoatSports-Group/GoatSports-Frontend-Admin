import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Log } from '@domain/entities/log';

@Component({
  selector: 'app-log-table',
  standalone: true,
  imports: [CommonModule, LucideIconComponent, MatProgressSpinnerModule],
  template: `
    <!-- Logs Table -->
    @if (loading) {
      <div class="min-h-[350px] flex flex-col items-center justify-center bg-white border border-slate-100 rounded-3xl shadow-sm">
        <mat-spinner diameter="40" color="accent"></mat-spinner>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Đang tải nhật ký hệ thống...</p>
      </div>
    } @else {
      @if (logs.length === 0) {
        <div class="flex flex-col items-center justify-center py-20 text-center bg-white border border-slate-100 rounded-3xl shadow-xs">
          <lucide-icon name="activity" class="text-slate-300 h-12 w-12 mb-4 mx-auto"></lucide-icon>
          <h3 class="text-sm font-bold text-slate-900">Không tìm thấy bản ghi log nào</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm font-medium">Hãy thử điều chỉnh bộ lọc hoặc chọn khoảng thời gian khác.</p>
        </div>
      } @else {
        <!-- Table Wrapper -->
        <div class="flex-1 min-h-0 flex flex-col bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
          <div class="flex-1 min-h-0 overflow-auto">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="border-b border-slate-100 text-[14px] font-bold tracking-wider text-emerald-400 bg-white sticky top-0 z-10">
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white">HTTP Method</th>
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white">Đường dẫn (Path)</th>
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white">Mã phản hồi</th>
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white">Thời gian chạy</th>
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white">Thời gian log</th>
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white">Địa chỉ IP</th>
                  <th class="py-4 px-6 font-bold text-emerald-500 bg-white text-right pr-8">Xem chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-sans">
                @for (log of logs; track log.logId) {
                  <tr class="hover:bg-emerald-50/30 transition-all duration-150 cursor-pointer" 
                      [ngClass]="{'bg-emerald-50/20 font-semibold border-l-2 border-l-emerald-600': selectedLog?.logId === log.logId}"
                      (click)="viewLogDetails(log)">
                    <!-- Method -->
                    <td class="py-3.5 px-6">
                      <span class="px-2.5 py-1 text-[11px] font-bold rounded-md border" [ngClass]="getMethodClass(log.method)">
                        {{ log.method }}
                      </span>
                    </td>
                    <!-- Path -->
                    <td class="py-3.5 px-6 font-mono text-xs text-slate-800 max-w-[280px] truncate" [title]="log.path">
                      {{ log.path }}
                    </td>
                    <!-- Status Code -->
                    <td class="py-3.5 px-6">
                      <span class="px-2.5 py-0.5 text-xs font-bold rounded-full" [ngClass]="getStatusClass(log.statusCode)">
                        {{ log.statusCode }}
                      </span>
                    </td>
                    <!-- Duration -->
                    <td class="py-3.5 px-6 font-medium">
                      <div class="flex items-center gap-1.5"
                           [ngClass]="log.duration > 1000 ? 'text-amber-600 font-bold' : 'text-slate-600'">
                        <span>{{ log.duration }}ms</span>
                        @if (log.duration > 1000) {
                          <lucide-icon name="alert-circle" class="h-3.5 w-3.5 shrink-0 text-amber-500" title="Yêu cầu xử lý chậm!"></lucide-icon>
                        }
                      </div>
                    </td>
                    <!-- Timestamp -->
                    <td class="py-3.5 px-6 text-slate-550 font-semibold text-xs">
                      {{ log.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}
                    </td>
                    <!-- IP Address -->
                    <td class="py-3.5 px-6 text-xs text-slate-450 font-mono">
                      {{ log.ipAddress || '-' }}
                    </td>
                    <!-- Actions -->
                    <td class="py-3.5 px-6 text-right pr-8">
                      <button (click)="viewLogDetails(log); $event.stopPropagation()"
                              class="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-900 hover:bg-emerald-50 transition-all cursor-pointer border border-transparent hover:border-slate-100">
                        <lucide-icon name="eye" class="h-4 w-4"></lucide-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination Bottom Bar -->
          <div class="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-slate-100 gap-4 bg-slate-50/10">
            <span class="text-xs font-semibold text-emerald-600">
              {{ getShowingText() }}
            </span>

            <div class="flex items-center gap-2">
              <!-- Previous Button -->
              <button [disabled]="pageIndex === 0" (click)="prevPage.emit()"
                      class="px-4 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-200 rounded-full hover:bg-emerald-50 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-[0.98] cursor-pointer">
                Trước
              </button>

              <!-- Page Numbers -->
              @for (p of pages; track p) {
                <button (click)="goToPage.emit(p)"
                        [class]="p === pageIndex ? 'w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs transition-all cursor-pointer shadow-xs' : 'w-8 h-8 rounded-full border border-slate-200 text-slate-700 hover:bg-emerald-50 flex items-center justify-center font-bold text-xs transition-all cursor-pointer'">
                  {{ p + 1 }}
                </button>
              }

              <!-- Next Button -->
              <button [disabled]="(pageIndex + 1) >= totalPages" (click)="nextPage.emit()"
                      class="px-4 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-slate-200 rounded-full hover:bg-emerald-50 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-[0.98] cursor-pointer">
                Tiếp
              </button>
            </div>
          </div>
        </div>
      }
    }

    <!-- Detail Slide-out Sheet Panel (Premium Overlay UX) -->
    @if (selectedLog) {
      <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[300] flex justify-end" (click)="closeDetails()">
        <div class="w-full max-w-lg bg-white h-full border-l border-slate-250 shadow-2xl flex flex-col z-[310] animate-slide-in relative"
             (click)="$event.stopPropagation()">

          <!-- Slide Header -->
          <div class="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600">
                <lucide-icon name="activity" class="h-4.5 w-4.5"></lucide-icon>
              </div>
              <div>
                <h2 class="text-sm font-bold text-slate-900 font-display">Chi tiết bản ghi Log</h2>
                <span class="text-[10px] text-slate-400 font-mono mt-0.5 block">ID: {{ selectedLog.logId }}</span>
              </div>
            </div>
            <button (click)="closeDetails()"
                    class="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-250 text-slate-650 flex items-center justify-center cursor-pointer border-0 outline-none transition-all">
              <lucide-icon name="x" class="h-4.5 w-4.5"></lucide-icon>
            </button>
          </div>

          <!-- Slide Content -->
          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <!-- Endpoint API Details -->
            <div class="bg-slate-50 border border-slate-150/40 rounded-2xl p-4 flex flex-col gap-3 font-sans">
              <div class="flex items-center gap-3">
                <span class="px-2.5 py-1 text-[11px] font-black rounded-md border"
                      [ngClass]="getMethodClass(selectedLog.method)">
                  {{ selectedLog.method }}
                </span>
                <span class="font-mono text-[13px] font-bold text-slate-900 break-all select-all">{{ selectedLog.path }}</span>
              </div>
              @if (selectedLog.queryParams) {
                <div class="border-t border-slate-200/50 pt-2.5 flex flex-col gap-1">
                  <span class="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Query Parameters</span>
                  <span class="font-mono text-xs text-slate-700 bg-slate-100/50 rounded-lg p-2 break-all border border-slate-200/40">{{ selectedLog.queryParams }}</span>
                </div>
              }
            </div>

            <!-- Status & Performance Stats -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-white border border-slate-155 rounded-2xl p-4 flex flex-col gap-1.5 shadow-xs">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mã phản hồi HTTP</span>
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0"
                        [ngClass]="selectedLog.statusCode >= 200 && selectedLog.statusCode < 300 ? 'bg-emerald-500' : (selectedLog.statusCode >= 400 ? 'bg-rose-500' : 'bg-amber-500')"></span>
                  <span class="text-xl font-black text-slate-900">{{ selectedLog.statusCode }}</span>
                </div>
              </div>

              <div class="bg-white border border-slate-155 rounded-2xl p-4 flex flex-col gap-1.5 shadow-xs">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Thời gian xử lý</span>
                <div class="flex items-center gap-1.5">
                  <lucide-icon name="clock" class="h-4.5 w-4.5 text-slate-400 shrink-0"></lucide-icon>
                  <span class="text-xl font-black text-slate-900">{{ selectedLog.duration }}ms</span>
                </div>
              </div>
            </div>

            <!-- Metadata Information -->
            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">Thông tin tác vụ</h3>

              <div class="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                <!-- User ID -->
                <div class="p-3.5 flex items-center justify-between text-xs font-semibold">
                  <span class="text-slate-400">Mã Người dùng (User ID)</span>
                  <span class="font-mono text-slate-800 break-all select-all text-right max-w-[200px] truncate"
                        [title]="selectedLog.userId || 'Không xác định'">
                    {{ selectedLog.userId || 'Khách (Anonymous)' }}
                  </span>
                </div>

                <!-- Client IP -->
                <div class="p-3.5 flex items-center justify-between text-xs font-semibold">
                  <span class="text-slate-400">Địa chỉ IP</span>
                  <span class="font-mono text-slate-800 text-right">{{ selectedLog.ipAddress || '-' }}</span>
                </div>

                <!-- Timestamp -->
                <div class="p-3.5 flex items-center justify-between text-xs font-semibold">
                  <span class="text-slate-400">Thời gian ghi nhận</span>
                  <span class="text-slate-800 text-right font-medium">{{ selectedLog.timestamp | date:'dd/MM/yyyy HH:mm:ss.SSS' }}</span>
                </div>
              </div>
            </div>

            <!-- Error Panel Details -->
            @if (selectedLog.errorMessage) {
              <div class="space-y-3">
                <h3 class="text-xs font-bold text-rose-500 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <lucide-icon name="alert-triangle" class="h-4 w-4"></lucide-icon> Lỗi & Ngoại lệ
                </h3>
                <div class="bg-rose-50 border border-rose-150/40 text-rose-700 font-mono text-[11px] leading-relaxed p-4 rounded-2xl whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {{ selectedLog.errorMessage }}
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `
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

  selectedLog: Log | null = null;

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }

  get pages(): number[] {
    const pagesArray = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(0, this.pageIndex - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages);

    if (endPage - startPage < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages);
    }

    for (let i = startPage; i < endPage; i++) {
      pagesArray.push(i);
    }
    return pagesArray;
  }

  getShowingText(): string {
    if (this.totalItems === 0) {
      return 'Xem 0 - 0 trong 0 kết quả';
    }
    const start = this.pageIndex * this.pageSize + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.totalItems);
    return `Xem ${start} - ${end} trong ${this.totalItems} kết quả`;
  }

  getMethodClass(method: string): string {
    switch (method?.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'POST':
        return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'PUT':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  }

  getStatusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    } else if (statusCode >= 300 && statusCode < 400) {
      return 'bg-sky-50 text-sky-700 border border-sky-100';
    } else if (statusCode >= 400 && statusCode < 500) {
      return 'bg-amber-50 text-amber-700 border border-amber-100';
    } else {
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    }
  }

  viewLogDetails(log: Log): void {
    this.selectedLog = log;
  }

  closeDetails(): void {
    this.selectedLog = null;
  }
}
