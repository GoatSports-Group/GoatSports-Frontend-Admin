import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Log } from '@application/dto/log/log.dto';
import { PaginationComponent } from '@shared/components/ui/pagination/pagination.component';
import {
  formatLogTimestamp,
  getHttpStatusClass,
  getLogActionBadgeClass
} from '@shared/utils/log-display.utils';

@Component({
  selector: 'app-log-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './log-table.component.html',
  styleUrls: ['./log-table.component.scss']
})
export class LogTableComponent {
  readonly getActionBadgeClass = getLogActionBadgeClass;
  readonly getStatusClass = getHttpStatusClass;
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
    return formatLogTimestamp(dateStr);
  }

  formatTimestampFull(dateStr: string): string {
    return formatLogTimestamp(dateStr, true);
  }



  onGoToPage(page: number): void {
    this.goToPage.emit(page);
  }
}
