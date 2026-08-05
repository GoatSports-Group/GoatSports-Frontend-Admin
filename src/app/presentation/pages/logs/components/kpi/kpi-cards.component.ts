import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LogStats } from '../models';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule, LucideIconComponent, DragDropModule],
  template: `
    <!-- Overview Stats Container - Flex row layout matching Users tab drag zone logic -->
    <div class="flex flex-col lg:flex-row items-center justify-between gap-5 w-full" 
         cdkDropList 
         cdkDropListOrientation="horizontal" 
         (cdkDropListDropped)="drop($event)">
      
      @if (loading || !stats) {
        @for (i of [1, 2, 3, 4]; track i) {
          <!-- Skeleton Card -->
          <div class="bg-white border border-slate-100 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between min-h-[90px] w-full lg:w-[calc(25%-15px)] animate-pulse">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 shrink-0"></div>
              <div class="flex-1 flex flex-col gap-2">
                <div class="h-3 bg-slate-150 rounded w-2/3"></div>
                <div class="h-6 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        }
      } @else {
        @for (card of statCards; track card.id) {
          <!-- Draggable Card - Constrained to 1 row on desktop (lg) and identical drag zone specs -->
          <div cdkDrag 
               cdkDragPreviewClass="cdk-user-stat-preview"
               class="bg-white border border-slate-100 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between min-h-[90px] w-full lg:w-[calc(25%-15px)] z-50 hover:shadow-sm transition-shadow bg-white cursor-default">
            
            <!-- Drag Placeholder matching layout width exactly -->
            <div *cdkDragPlaceholder class="border-slate-200 rounded-xl min-h-[90px] w-full lg:w-[calc(25%-15px)]"></div>

            <!-- Top Row -->
            <div class="flex items-start justify-between z-10 relative w-full">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                  <lucide-icon [name]="card.icon" [class]="'h-5 w-5 ' + card.iconColor"></lucide-icon>
                </div>
                <div class="flex flex-col gap-1">
                  <h1 class="font-bold text-slate-500 text-sm leading-none">{{ card.title }}</h1>
                  <span class="text-[18px] font-bold text-slate-900 mt-1 leading-none">{{ card.count }}</span>
                </div>
              </div>

              <!-- Drag Handle -->
              <div cdkDragHandle
                   class="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-550 p-1 -mr-1 -mt-1 rounded transition-colors"
                   title="Kéo để di chuyển">
                <lucide-icon name="grip-horizontal" class="h-4 w-4"></lucide-icon>
              </div>
            </div>

          </div>
        }
      }
    </div>
  `
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
        id: 'avg',
        title: 'Thời gian trung bình',
        count: Math.round(this.stats.avgResponseTime) + ' ms',
        icon: 'gauge',
        iconColor: 'text-blue-500'
      },
      {
        id: 'p95',
        title: 'Thời gian P95',
        count: Math.round(this.stats.p95ResponseTime) + ' ms',
        icon: 'timer',
        iconColor: 'text-amber-500'
      }
    ];
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.statCards, event.previousIndex, event.currentIndex);
  }
}
