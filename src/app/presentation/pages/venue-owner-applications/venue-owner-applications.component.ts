import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { InfiniteScrollDirective, LIST_CHUNK } from '@shared/directives/infinite-scroll.directive';
import { CommonModule } from '@angular/common';
import { OwnerApplication, OwnerApplicationStatus } from '@application/dto/owner-application/owner-application.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { PageLoadingComponent } from '@shared/components/ui/page-loading/page-loading.component';
import { OwnerApplicationProgressComponent } from '@presentation/pages/dashboard/owner-application-progress/owner-application-progress.component';
import {
  buildOwnerApplicationProgress,
  formatOwnerApplicationAddress,
  getBusinessTypeLabel,
  getOwnerApplicationStatusLabel
} from '@presentation/pages/dashboard/owner-application-progress/owner-application-progress.utils';
import { VenueOwnerApplicationFormComponent } from './venue-owner-application-form.component';

const MAX_WINDOW = LIST_CHUNK * 3;

@Component({
  selector: 'app-venue-owner-applications',
  standalone: true,
  imports: [InfiniteScrollDirective, 
    CommonModule,
    LucideIconComponent,
    PageLoadingComponent,
    OwnerApplicationProgressComponent,
    VenueOwnerApplicationFormComponent
  ],
  templateUrl: './venue-owner-applications.component.html',
  styleUrl: './venue-owner-applications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerApplicationsComponent implements OnInit {
  private readonly getApplications = inject(GetMyOwnerApplicationsUseCase);
  private readonly notify = inject(NotifyService);

  readonly getAddress = formatOwnerApplicationAddress;
  readonly getBusinessTypeLabel = getBusinessTypeLabel;
  readonly getStatusLabel = getOwnerApplicationStatusLabel;
  readonly activeView = signal<'history' | 'form'>('history');
  readonly applications = signal<OwnerApplication[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  /**
   * Cuon vo han hai chieu: chi render mot cua so toi da 3 x LIST_CHUNK ho so. Cham day thi noi them o duoi (bot o tren),
   * cuon nguoc len dau thi noi lai o tren (bot o duoi); vi tri doc duoc giu nguyen nen danh sach khong nhay.
   */
  readonly windowStart = signal(0);
  readonly windowEnd = signal(LIST_CHUNK);
  private readonly injector = inject(Injector);
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('applicationList');
  readonly selectedApplicationId = signal<string | null>(null);
  readonly hasPendingApplication = computed(() => this.applications().some(
    application => application.status === OwnerApplicationStatus.PENDING
  ));
  readonly filteredApplications = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('vi');
    if (!query) return this.applications();
    return this.applications().filter(application => [
      application.businessName,
      application.fullName,
      application.email,
      application.phone,
      this.getStatusLabel(application.status)
    ].some(value => value.toLocaleLowerCase('vi').includes(query)));
  });
  readonly pagedApplications = computed(() => this.filteredApplications().slice(this.windowStart(), this.windowEnd()));
  readonly selectedApplication = computed(() => {
    const visibleApplications = this.filteredApplications();
    return visibleApplications.find(application => application.ownerApplicationId === this.selectedApplicationId())
      ?? visibleApplications[0]
      ?? null;
  });
  readonly selectedProgress = computed(() => {
    const application = this.selectedApplication();
    return application ? buildOwnerApplicationProgress(application) : null;
  });

  ngOnInit(): void { this.loadApplications(); }

  openHistory(): void {
    this.activeView.set('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openForm(): void {
    if (this.hasPendingApplication()) {
      this.notify.warning('Bạn đang có một đơn đăng ký chờ duyệt. Vui lòng theo dõi đơn hiện tại trước khi tạo đơn mới.');
      return;
    }
    this.activeView.set('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  handleSubmitted(): void {
    this.openHistory();
    this.loadApplications();
  }

  updateSearch(query: string): void {
    this.searchQuery.set(query);
    this.resetWindow();
    const firstMatch = this.filteredApplications()[0];
    this.selectedApplicationId.set(firstMatch?.ownerApplicationId ?? null);
  }

  selectApplication(application: OwnerApplication): void {
    this.selectedApplicationId.set(application.ownerApplicationId);
  }

  showMore(): void {
    const total = this.filteredApplications().length;
    if (this.windowEnd() >= total) return;
    const end = Math.min(total, this.windowEnd() + LIST_CHUNK);
    const start = Math.max(this.windowStart(), end - MAX_WINDOW);
    this.moveWindow(start, end, this.filteredApplications()[start]?.ownerApplicationId);
  }

  showPrevious(): void {
    if (this.windowStart() <= 0) return;
    const start = Math.max(0, this.windowStart() - LIST_CHUNK);
    const end = Math.min(this.windowEnd(), start + MAX_WINDOW);
    this.moveWindow(start, end, this.filteredApplications()[this.windowStart()]?.ownerApplicationId);
  }

  private resetWindow(): void {
    this.windowStart.set(0);
    this.windowEnd.set(LIST_CHUNK);
  }

  /** Doi cua so render nhung giu ho so `anchorId` dung cho cu tren man hinh. */
  private moveWindow(start: number, end: number, anchorId: string | undefined): void {
    const list = this.listRef()?.nativeElement;
    const anchorTop = anchorId ? this.itemTop(list, anchorId) : null;
    this.windowStart.set(start);
    this.windowEnd.set(end);
    if (!list || anchorTop === null) return;
    afterNextRender(() => {
      const top = this.itemTop(list, anchorId!);
      if (top !== null) list.scrollTop += top - anchorTop;
    }, { injector: this.injector });
  }

  private itemTop(list: HTMLElement | undefined, id: string): number | null {
    const item = list?.querySelector<HTMLElement>(`[data-application-id="${id}"]`);
    return item ? item.getBoundingClientRect().top : null;
  }

  getStatusIcon(status: OwnerApplicationStatus): string {
    if (status === OwnerApplicationStatus.APPROVED) return 'circle-check';
    if (status === OwnerApplicationStatus.REJECTED) return 'x';
    if (status === OwnerApplicationStatus.CANCELLED) return 'ban';
    return 'clock';
  }

  getStatusTone(status: OwnerApplicationStatus): string {
    return status.toLowerCase();
  }

  loadApplications(showLoading = true): void {
    if (showLoading) this.loading.set(true);
    this.error.set(null);
    // ponytail: ho so cua chinh chu san (thuc te vai ho so) nen tai mot lan 100; tim kiem tai client.
    this.getApplications.execute({ page: 0, size: 100 }).subscribe({
      next: response => {
        const applications = this.newestFirst(response.result ?? []);
        this.applications.set(applications);
        this.resetWindow();
        this.selectedApplicationId.set(applications[0]?.ownerApplicationId ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải danh sách đơn đăng ký.');
        this.loading.set(false);
        this.notify.error('Không thể tải danh sách đơn đăng ký.');
      }
    });
  }

  private newestFirst(applications: OwnerApplication[]): OwnerApplication[] {
    return [...applications].sort((left, right) =>
      this.timestamp(right.createdAt) - this.timestamp(left.createdAt)
    );
  }

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
