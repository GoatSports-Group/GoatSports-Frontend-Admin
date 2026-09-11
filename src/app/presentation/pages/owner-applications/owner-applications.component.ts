import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { GetOwnerApplicationDetailUseCase } from '@application/usecase/owner-application/get-owner-application-detail.usecase';
import { ApproveOwnerApplicationUseCase } from '@application/usecase/owner-application/approve-owner-application.usecase';
import { RejectOwnerApplicationUseCase } from '@application/usecase/owner-application/reject-owner-application.usecase';
import { MarkOwnerApplicationViewedUseCase } from '@application/usecase/owner-application/mark-owner-application-viewed.usecase';
import {
  OwnerApplication,
  OwnerApplicationDocument,
  OWNER_APPLICATION_STATUS_OPTIONS,
  OwnerApplicationStatus
} from '@application/dto/owner-application/owner-application.dto';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@shared/components/notify/notify.service';
import { RejectReasonDialogComponent } from '@presentation/pages/owner-applications/owner-application-dialog/reject-reason-dialog.component';
import { DocumentPreviewDialogComponent } from '@presentation/pages/owner-applications/document-preview-dialog/document-preview-dialog.component';
import { Subject, Subscription, debounceTime, finalize } from 'rxjs';
import {
  buildOwnerApplicationFilter,
  getBusinessTypeLabel,
  getDocumentTypeLabel,
  getIdCardDocuments,
  getNonIdCardDocuments,
  getOwnerApplicationStatusLabel,
  isIdCardDocument,
  sortOwnerApplications
} from './owner-applications.utils';

@Component({
  selector: 'app-admin-owner-applications',
  templateUrl: './owner-applications.component.html',
  styleUrls: ['./owner-applications.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwnerApplicationsComponent implements OnInit {
  private getAllUseCase = inject(GetAllOwnerApplicationsUseCase);
  private getDetailUseCase = inject(GetOwnerApplicationDetailUseCase);
  private approveUseCase = inject(ApproveOwnerApplicationUseCase);
  private rejectUseCase = inject(RejectOwnerApplicationUseCase);
  private markViewedUseCase = inject(MarkOwnerApplicationViewedUseCase);
  private dialog = inject(MatDialog);
  private snackBar = inject(NotifyService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private searchChanges = new Subject<void>();
  private listSubscription?: Subscription;
  private detailSubscription?: Subscription;

  readonly OwnerApplicationStatus = OwnerApplicationStatus;
  readonly OwnerApplicationStatusOp = OWNER_APPLICATION_STATUS_OPTIONS;
  readonly getStatusLabel = getOwnerApplicationStatusLabel;
  readonly getDocumentTypeLabel = getDocumentTypeLabel;
  readonly getBusinessTypeLabel = getBusinessTypeLabel;
  readonly isIdCardDoc = isIdCardDocument;
  readonly getIdCardDocs = getIdCardDocuments;
  readonly getNonIdCardDocs = getNonIdCardDocuments;

  filteredApplications: OwnerApplication[] = [];
  selectedApplication: OwnerApplication | null = null;

  loadingList = false;
  loadingDetail = false;
  processingAction = false;

  filterStatus: string = 'ALL';
  searchQuery = '';

  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;

  ngOnInit() {
    this.searchChanges.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadApplications();
    });
    this.loadApplications();
  }

  loadApplications() {
    this.listSubscription?.unsubscribe();
    this.loadingList = true;
    const filterQuery = buildOwnerApplicationFilter(this.filterStatus, this.searchQuery);

    this.listSubscription = this.getAllUseCase.execute({
      page: this.pageIndex,
      size: this.pageSize,
      filter: filterQuery
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loadingList = false;
        this.changeDetectorRef.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        const applications = response?.result ?? [];
        this.filteredApplications = sortOwnerApplications(applications);

        this.totalItems = response?.meta?.total ?? applications.length;

        const firstApp = this.filteredApplications.length > 0 ? this.filteredApplications[0] : null;
        if (firstApp) {
          this.selectApplication(firstApp);
        } else {
          this.selectedApplication = null;
        }
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Không thể tải danh sách đơn đăng ký làm chủ sân!', 'Đóng', {
          duration: 4000
        });
      }
    });
  }

  onFilterStatusChange(status: string) {
    this.filterStatus = status;
    this.pageIndex = 0;
    this.loadApplications();
  }

  onSearchChange() {
    this.searchChanges.next();
  }

  selectApplication(app: OwnerApplication) {
    this.detailSubscription?.unsubscribe();
    this.selectedApplication = app;
    this.loadingDetail = false;
    this.changeDetectorRef.markForCheck();

    if (app.status === OwnerApplicationStatus.PENDING) {
      this.markViewedUseCase.execute(app.ownerApplicationId).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        error: error => console.warn('Failed to mark owner application as viewed:', error)
      });
    }

    const selectedId = app.ownerApplicationId;
    this.detailSubscription = this.getDetailUseCase.execute(selectedId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (this.selectedApplication?.ownerApplicationId === selectedId) {
          this.loadingDetail = false;
          this.changeDetectorRef.markForCheck();
        }
      })
    ).subscribe({
      next: (fullDetails) => {
        if (this.selectedApplication?.ownerApplicationId === selectedId) {
          this.selectedApplication = fullDetails;
        }
      },
      error: (err) => {
        console.error('Failed to load application details', err);
      }
    });
  }

  approve(app: OwnerApplication) {
    if (this.processingAction) return;

    this.processingAction = true;
    this.approveUseCase.execute(app.ownerApplicationId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.processingAction = false;
        this.changeDetectorRef.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.snackBar.open(`Đã phê duyệt đơn đăng ký của ${app.fullName} thành công!`, 'Đóng', {
          duration: 5000
        });

        const updatedApp: OwnerApplication = {
          ...app,
          status: OwnerApplicationStatus.APPROVED
        };

        this.filteredApplications = sortOwnerApplications(
          this.filteredApplications.map(a => a.ownerApplicationId === app.ownerApplicationId ? updatedApp : a)
        );
        this.selectedApplication = updatedApp;
      },
      error: (err) => {
        console.error(err);
        const errMsg = err.error?.message || 'Có lỗi xảy ra trong quá trình phê duyệt đơn.';
        this.snackBar.open(errMsg, 'Đóng', {
          duration: 4000
        });
      }
    });
  }

  reject(app: OwnerApplication) {
    if (this.processingAction) return;

    const dialogRef = this.dialog.open(RejectReasonDialogComponent, {
      width: '450px',
      disableClose: true,
      panelClass: 'custom-premium-dialog'
    });

    dialogRef.afterClosed().subscribe((reason: string | null) => {
      if (reason) {
        this.processingAction = true;
        this.rejectUseCase.execute(app.ownerApplicationId, reason).pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => {
            this.processingAction = false;
            this.changeDetectorRef.markForCheck();
          })
        ).subscribe({
          next: () => {
            this.snackBar.open(`Đã từ chối đơn đăng ký của ${app.fullName}.`, 'Đóng', {
              duration: 5000
            });

            const updatedApp: OwnerApplication = {
              ...app,
              status: OwnerApplicationStatus.REJECTED,
              rejectReason: reason
            };

            this.filteredApplications = sortOwnerApplications(
              this.filteredApplications.map(a => a.ownerApplicationId === app.ownerApplicationId ? updatedApp : a)
            );
            this.selectedApplication = updatedApp;
          },
          error: (err) => {
            console.error(err);
            const errMsg = err.error?.message || 'Có lỗi xảy ra trong quá trình từ chối đơn.';
            this.snackBar.open(errMsg, 'Đóng', {
              duration: 4000
            });
          }
        });
      }
    });
  }

  viewDocument(doc: OwnerApplicationDocument): void {
    this.dialog.open(DocumentPreviewDialogComponent, {
      width: '800px',
      disableClose: false,
      panelClass: 'custom-premium-dialog',
      data: {
        title: this.getDocumentTypeLabel(doc.documentType),
        fileUrl: doc.fileUrl
      }
    });
  }

  viewIdCardDocuments(docs: OwnerApplicationDocument[]): void {
    this.dialog.open(DocumentPreviewDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      disableClose: false,
      panelClass: 'custom-premium-dialog',
      data: {
        title: 'Căn Cước Công Dân (CCCD)',
        fileUrls: docs.map(d => d.fileUrl),
        fileLabels: docs.map((d, i) => {
          return `Ảnh ${i + 1}`;
        })
      }
    });
  }

  goToPage(page: number): void {
    this.pageIndex = page;
    this.loadApplications();
  }
}
