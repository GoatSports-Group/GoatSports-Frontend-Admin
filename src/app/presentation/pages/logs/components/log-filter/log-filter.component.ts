import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { formatInputDate } from '@shared/utils/log-display.utils';

@Component({
  selector: 'app-log-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideIconComponent],
  templateUrl: './log-filter.component.html',
  styleUrls: ['./log-filter.component.scss']
})
export class LogFilterComponent {
  readonly formatDateToVietnamese = formatInputDate;
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

}
