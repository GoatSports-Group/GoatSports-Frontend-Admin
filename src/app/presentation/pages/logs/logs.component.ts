import { Component, OnInit, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';
import { Log } from '@application/dto/log/log.dto';
import { LogService } from '@presentation/services/log.service';
import { LogStats } from './components/models';
import { buildLogFilter, computeLogStats, mergeUniqueLogActions } from './logs.utils';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
  standalone: false
})
export class LogsComponent implements OnInit {
  private logService = inject(LogService);
  private snackBar = inject(NotifyService);

  logs: Log[] = [];
  loading = false;

  // Pagination states
  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;

  // Custom filter models
  filterDescription = '';
  filterAction = '';
  filterFromDate = '';
  filterToDate = '';
  
  uniqueActions: string[] = [];

  // Overview stats dashboard states
  stats: LogStats | null = null;
  loadingStats = false;

  ngOnInit(): void {
    this.loadLogs();
    this.loadStats();
  }

  loadLogs(): void {
    this.loading = true;

    const filterQuery = buildLogFilter({
      description: this.filterDescription,
      action: this.filterAction,
      fromDate: this.filterFromDate,
      toDate: this.filterToDate
    });

    this.logService.getLogs({
      page: this.pageIndex,
      size: this.pageSize,
      filter: filterQuery || undefined
    }).subscribe({
      next: response => {
        this.logs = response?.result ?? [];
        this.totalItems = response?.meta?.total ?? 0;
        this.loading = false;
        this.uniqueActions = mergeUniqueLogActions(this.uniqueActions, this.logs);
      },
      error: err => {
        console.error(err);
        this.loading = false;

        this.snackBar.open(
          "Không thể tải nhật ký hệ thống!",
          "Đóng",
          {
            duration: 4000,
            horizontalPosition: "end",
            verticalPosition: "top",
            panelClass: ["snackbar-error"]
          }
        );
      }
    });
  }

  loadStats(): void {
    this.loadingStats = true;

    // Load last 500 logs to perform live stats calculations
    this.logService.getLogs({ page: 0, size: 500 }).subscribe({
      next: (response) => {
        const allLogs = response?.result || [];
        this.stats = computeLogStats(allLogs);
        this.loadingStats = false;
        this.uniqueActions = mergeUniqueLogActions(this.uniqueActions, allLogs);
      },
      error: (err) => {
        console.error('Failed to load log stats:', err);
        this.stats = computeLogStats([]);
        this.loadingStats = false;
      }
    });
  }

  onSearch(): void {
    this.pageIndex = 0;
    this.loadLogs();
  }

  resetFilters(): void {
    this.filterDescription = '';
    this.filterAction = '';
    this.filterFromDate = '';
    this.filterToDate = '';
    this.pageIndex = 0;
    this.loadLogs();
  }

  onPrevPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex--;
      this.loadLogs();
    }
  }

  onNextPage(): void {
    if ((this.pageIndex + 1) * this.pageSize < this.totalItems) {
      this.pageIndex++;
      this.loadLogs();
    }
  }

  goToPage(page: number): void {
    this.pageIndex = page;
    this.loadLogs();
  }
}
