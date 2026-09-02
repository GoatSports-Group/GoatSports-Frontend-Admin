import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-venue-owner-applications',
  standalone: true,
  imports: [
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
  private readonly pageSize = 5;
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
  readonly currentPage = signal(1);
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
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredApplications().length / this.pageSize)));
  readonly pagedApplications = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredApplications().slice(start, start + this.pageSize);
  });
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
    this.currentPage.set(1);
    const firstMatch = this.filteredApplications()[0];
    this.selectedApplicationId.set(firstMatch?.ownerApplicationId ?? null);
  }

  selectApplication(application: OwnerApplication): void {
    this.selectedApplicationId.set(application.ownerApplicationId);
  }

  previousPage(): void {
    if (this.currentPage() <= 1) return;
    this.currentPage.update(page => page - 1);
    this.selectFirstApplicationOnPage();
  }

  nextPage(): void {
    if (this.currentPage() >= this.totalPages()) return;
    this.currentPage.update(page => page + 1);
    this.selectFirstApplicationOnPage();
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
    this.getApplications.execute({ page: 0, size: 100 }).subscribe({
      next: response => {
        const applications = this.newestFirst(response.result ?? []);
        this.applications.set(applications);
        this.currentPage.set(1);
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

  private selectFirstApplicationOnPage(): void {
    this.selectedApplicationId.set(this.pagedApplications()[0]?.ownerApplicationId ?? null);
  }

  private timestamp(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }
}
