import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LogStats } from '../../models';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule, LucideIconComponent, DragDropModule],
  templateUrl: './kpi-cards.component.html',
  styleUrls: ['./kpi-cards.component.scss']
})
export class KpiCardsComponent implements OnChanges {
  @Input() stats: LogStats | null = null;
  @Input() loading = false;

  statCards: any[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['stats'] || changes['loading']) && this.stats) {
      this.buildStatCards();
    }
  }

  buildStatCards(): void {
    if (!this.stats) return;
    this.statCards = [
      {
        id: 'total',
        title: 'Tổng số yêu cầu',
        count: this.stats.totalRequests.toLocaleString('vi-VN'),
        icon: 'activity',
        iconColor: 'text-emerald-500'
      },
      {
        id: 'error',
        title: 'Tỷ lệ lỗi',
        count: this.stats.errorRate.toFixed(2) + '%',
        icon: 'alert-triangle',
        iconColor: 'text-rose-500'
      },
      {
        id: 'actions',
        title: 'Loại nghiệp vụ',
        count: this.stats.activeApis.toLocaleString('vi-VN'),
        icon: 'layout-grid',
        iconColor: 'text-amber-500'
      }
    ];
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.statCards, event.previousIndex, event.currentIndex);
  }
}
