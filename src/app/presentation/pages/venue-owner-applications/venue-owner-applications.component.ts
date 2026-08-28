import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OwnerApplication } from '@application/dto/owner-application/owner-application.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { NotifyService } from '@shared/components/notify/notify.service';
import { OwnerApplicationProgressComponent } from '@presentation/pages/dashboard/owner-application-progress/owner-application-progress.component';
import { VenueOwnerApplicationFormComponent } from './venue-owner-application-form.component';

@Component({
  selector: 'app-venue-owner-applications',
  standalone: true,
  imports: [CommonModule, OwnerApplicationProgressComponent, VenueOwnerApplicationFormComponent],
  templateUrl: './venue-owner-applications.component.html',
  styleUrl: './venue-owner-applications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueOwnerApplicationsComponent implements OnInit {
  private readonly getApplications = inject(GetMyOwnerApplicationsUseCase);
  private readonly notify = inject(NotifyService);

  readonly activeView = signal<'history' | 'form'>('history');
  readonly applications = signal<OwnerApplication[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void { this.loadApplications(); }

  openHistory(): void {
    this.activeView.set('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openForm(): void {
    this.activeView.set('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  handleSubmitted(result: OwnerApplication[]): void {
    this.applications.set(this.newestFirst(result));
    this.openHistory();
  }

  loadApplications(showLoading = true): void {
    if (showLoading) this.loading.set(true);
    this.error.set(null);
    this.getApplications.execute({ page: 0, size: 100 }).subscribe({
      next: response => {
        this.applications.set(this.newestFirst(response.result ?? []));
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
