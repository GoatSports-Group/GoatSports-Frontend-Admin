import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
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
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">

        <!-- Activity Content Search -->
        <div class="md:col-span-2 flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Nội dung hoạt động</label>
          <div class="relative w-full">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <lucide-icon name="search" class="text-slate-400 h-4 w-4"></lucide-icon>
            </span>
            <input type="text"
                   [ngModel]="filterDescription"
                   (ngModelChange)="filterDescriptionChange.emit($event)"
                   (keyup.enter)="search.emit()"
                   placeholder="Tìm kiếm nội dung hoạt động (ví dụ: đăng ký, phê duyệt...)"
                   class="w-full h-11 bg-slate-50/70 border-0 rounded-2xl pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all">
          </div>
        </div>

        <!-- Business Action Custom Dropdown -->
        <div class="flex flex-col gap-1.5 action-select-container relative">
          <label class="text-sm font-bold text-emerald-800">Mã hành động</label>
          <div class="relative w-full">
            <!-- Dropdown Trigger Button -->
            <button type="button"
                    (click)="toggleDropdown()"
                    class="w-full h-11 bg-slate-50/70 hover:bg-slate-100/50 border-0 rounded-2xl pl-10 pr-10 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100/80 transition-all flex items-center justify-between cursor-pointer select-none text-left">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <lucide-icon name="shield" class="text-slate-400 h-4 w-4"></lucide-icon>
              </span>
              <span>{{ filterAction || 'Tất cả' }}</span>
              <span class="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                <lucide-icon name="chevron-down" 
                             class="text-slate-400 h-4 w-4 transition-transform duration-300"
                             [class.rotate-180]="isDropdownOpen"></lucide-icon>
              </span>
            </button>

            <!-- Dropdown Menu Overlay -->
            @if (isDropdownOpen) {
              <div class="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl py-2 max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <!-- Option "Tất cả" -->
                <div (click)="selectAction('')"
                     class="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all cursor-pointer flex items-center justify-between"
                     [class.bg-emerald-50/50]="!filterAction"
                     [class.text-emerald-700]="!filterAction">
                  <span>Tất cả</span>
                  @if (!filterAction) {
                    <lucide-icon name="check" class="h-3.5 w-3.5 text-emerald-600"></lucide-icon>
                  }
                </div>
                <!-- Dynamic Options -->
                @for (act of actions; track act) {
                  <div (click)="selectAction(act)"
                       class="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all cursor-pointer flex items-center justify-between"
                       [class.bg-emerald-50/50]="filterAction === act"
                       [class.text-emerald-700]="filterAction === act">
                    <span>{{ act }}</span>
                    @if (filterAction === act) {
                      <lucide-icon name="check" class="h-3.5 w-3.5 text-emerald-600"></lucide-icon>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Date From -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Từ ngày</label>
          <div class="relative w-full h-11 bg-slate-50/70 rounded-2xl flex items-center px-4 border-0 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:bg-slate-100/80 transition-all cursor-pointer"
               (click)="fromPicker.showPicker()">
            <lucide-icon name="calendar" class="text-slate-400 h-4 w-4 mr-2.5 shrink-0"></lucide-icon>
            <span class="text-xs font-semibold" [ngClass]="filterFromDate ? 'text-slate-800' : 'text-slate-400'">
              {{ filterFromDate ? formatDateToVietnamese(filterFromDate) : 'dd/mm/yyyy' }}
            </span>
            <input type="date"
                   #fromPicker
                   [ngModel]="filterFromDate"
                   (ngModelChange)="filterFromDateChange.emit($event)"
                   (click)="$event.stopPropagation(); fromPicker.showPicker()"
                   class="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" />
          </div>
        </div>

        <!-- Date To -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-bold text-emerald-800">Đến ngày</label>
          <div class="relative w-full h-11 bg-slate-50/70 rounded-2xl flex items-center px-4 border-0 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:bg-slate-100/80 transition-all cursor-pointer"
               (click)="toPicker.showPicker()">
            <lucide-icon name="calendar" class="text-slate-400 h-4 w-4 mr-2.5 shrink-0"></lucide-icon>
            <span class="text-xs font-semibold" [ngClass]="filterToDate ? 'text-slate-800' : 'text-slate-400'">
              {{ filterToDate ? formatDateToVietnamese(filterToDate) : 'dd/mm/yyyy' }}
            </span>
            <input type="date"
                   #toPicker
                   [ngModel]="filterToDate"
                   (ngModelChange)="filterToDateChange.emit($event)"
                   (click)="$event.stopPropagation(); toPicker.showPicker()"
                   class="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" />
          </div>
        </div>
      </div>

      <!-- Row 2: Action Buttons -->
      <div class="flex justify-end gap-3 mt-4">
        <button (click)="search.emit()"
          class="px-6 h-10 bg-primary hover:bg-emerald-800 active:scale-[0.98] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
          <lucide-icon name="search" class="h-4 w-4"></lucide-icon> Tìm kiếm
        </button>
        <button (click)="reset.emit()"
          class="px-6 h-10 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 font-bold text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
          <lucide-icon name="rotate-ccw" class="h-4 w-4"></lucide-icon> Làm mới
        </button>
      </div>

    </div>
  `
})
export class LogFilterComponent {
  @Input() filterDescription = '';
  @Input() filterAction = '';
  @Input() filterFromDate = '';
  @Input() filterToDate = '';
  @Input() actions: string[] = [];

  @Output() filterDescriptionChange = new EventEmitter<string>();
  @Output() filterActionChange = new EventEmitter<string>();
  @Output() filterFromDateChange = new EventEmitter<string>();
  @Output() filterToDateChange = new EventEmitter<string>();

  @Output() search = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();

  isDropdownOpen = false;

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectAction(act: string) {
    this.filterAction = act;
    this.filterActionChange.emit(act);
    this.search.emit();
    this.isDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.action-select-container')) {
      this.isDropdownOpen = false;
    }
  }

  formatDateToVietnamese(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
}
