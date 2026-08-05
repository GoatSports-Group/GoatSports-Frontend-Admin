import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';

@Component({
  selector: 'app-log-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconComponent],
  template: `
    <div class="bg-white border border-slate-100/85 rounded-3xl p-6 shadow-xs">

      <!-- Row 1: Filters -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">

        <!-- Path Search -->
        <div class="md:col-span-2 flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Đường dẫn (Path)</label>
          <div class="relative w-full">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <lucide-icon name="search" class="text-slate-400 h-4 w-4"></lucide-icon>
            </span>
            <input type="text"
                   [ngModel]="filterPath"
                   (ngModelChange)="filterPathChange.emit($event)"
                   (keyup.enter)="search.emit()"
                   placeholder="Ví dụ: /api/v1/users..."
                   class="w-full h-11 bg-slate-50/70 border-0 rounded-2xl pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all">
          </div>
        </div>

        <!-- HTTP Method -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Phương thức (Method)</label>
          <select [ngModel]="filterMethod"
                  (ngModelChange)="filterMethodChange.emit($event)"
                  class="w-full h-11 bg-slate-50/70 border-0 rounded-2xl px-4 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all cursor-pointer">
            <option value="">Tất cả</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>

        <!-- Status Code -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Trạng thái (Status)</label>
          <select [ngModel]="filterStatusClass"
                  (ngModelChange)="filterStatusClassChange.emit($event)"
                  class="w-full h-11 bg-slate-50/70 border-0 rounded-2xl px-4 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all cursor-pointer">
            <option value="">Tất cả</option>
            <option value="2xx">Thành công (2xx)</option>
            <option value="4xx">Lỗi Client (4xx)</option>
            <option value="5xx">Lỗi Server (5xx)</option>
          </select>
        </div>

        <!-- Date From -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Từ ngày</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <lucide-icon name="calendar" class="text-slate-400 h-4 w-4"></lucide-icon>
            </span>
            <input type="date"
                   [ngModel]="filterFromDate"
                   (ngModelChange)="filterFromDateChange.emit($event)"
                   class="w-full h-11 pl-10 pr-4 bg-slate-50/70 border-0 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all cursor-pointer" />
          </div>
        </div>

        <!-- Date To -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Đến ngày</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <lucide-icon name="calendar" class="text-slate-400 h-4 w-4"></lucide-icon>
            </span>
            <input type="date"
                   [ngModel]="filterToDate"
                   (ngModelChange)="filterToDateChange.emit($event)"
                   class="w-full h-11 pl-10 pr-4 bg-slate-50/70 border-0 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all cursor-pointer" />
          </div>
        </div>
      </div>

      <!-- Row 2: Action Buttons -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div class="col-start-1 md:col-start-4 flex items-center gap-3">
          <button (click)="search.emit()"
            class="flex-1 h-10 bg-primary hover:bg-emerald-800 active:scale-[0.98] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
            <lucide-icon name="search" class="h-4 w-4"></lucide-icon> Tìm kiếm
          </button>
          <button (click)="reset.emit()"
            class="flex-1 h-10 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
            <lucide-icon name="rotate-ccw" class="h-4 w-4"></lucide-icon> Làm mới
          </button>
        </div>
      </div>

    </div>
  `
})
export class LogFilterComponent {
  @Input() filterPath = '';
  @Input() filterMethod = '';
  @Input() filterStatusClass = '';
  @Input() filterFromDate = '';
  @Input() filterToDate = '';

  @Output() filterPathChange = new EventEmitter<string>();
  @Output() filterMethodChange = new EventEmitter<string>();
  @Output() filterStatusClassChange = new EventEmitter<string>();
  @Output() filterFromDateChange = new EventEmitter<string>();
  @Output() filterToDateChange = new EventEmitter<string>();

  @Output() search = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
}
