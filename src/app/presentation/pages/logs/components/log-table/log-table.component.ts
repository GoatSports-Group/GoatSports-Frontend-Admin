import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Log } from '@domain/entities/log';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';

@Component({
  selector: 'app-log-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './log-table.component.html',
  styleUrls: ['./log-table.component.scss']
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



  onGoToPage(page: number): void {
    this.goToPage.emit(page);
  }
}
