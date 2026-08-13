import { Component, OnInit, inject } from '@angular/core';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { GetOwnerApplicationDetailUseCase } from '@application/usecase/owner-application/get-owner-application-detail.usecase';
import { ApproveOwnerApplicationUseCase } from '@application/usecase/owner-application/approve-owner-application.usecase';
import { RejectOwnerApplicationUseCase } from '@application/usecase/owner-application/reject-owner-application.usecase';
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
  standalone: false
})
export class OwnerApplicationsComponent implements OnInit {
  private getAllUseCase = inject(GetAllOwnerApplicationsUseCase);
  private getDetailUseCase = inject(GetOwnerApplicationDetailUseCase);
  private approveUseCase = inject(ApproveOwnerApplicationUseCase);
  private rejectUseCase = inject(RejectOwnerApplicationUseCase);
  private dialog = inject(MatDialog);
  private snackBar = inject(NotifyService);

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
    this.loadApplications();
  }

  loadApplications() {
    this.loadingList = true;
    const filterQuery = buildOwnerApplicationFilter(this.filterStatus, this.searchQuery);

    this.getAllUseCase.execute({
      page: this.pageIndex,
      size: this.pageSize,
      filter: filterQuery
    }).subscribe({
      next: (response) => {
        this.filteredApplications = sortOwnerApplications(response.result);

        if (response.result.length < this.pageSize) {
          this.totalItems = this.pageIndex * this.pageSize + response.result.length;
        } else {
          this.totalItems = (this.pageIndex + 2) * this.pageSize;
        }

        this.loadingList = false;

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
        this.loadingList = false;
      }
    });
  }

  onFilterStatusChange(status: string) {
    this.filterStatus = status;
    this.pageIndex = 0;
    this.loadApplications();
  }

  onSearchChange() {
    this.pageIndex = 0;
    this.loadApplications();
  }

  selectApplication(app: OwnerApplication) {
    this.loadingDetail = true;
    this.selectedApplication = app;
    this.getDetailUseCase.execute(app.ownerApplicationId).subscribe({
      next: (fullDetails) => {
        this.selectedApplication = fullDetails;
        this.loadingDetail = false;
      },
      error: (err) => {
        console.error('Failed to load application details', err);
        this.loadingDetail = false;
      }
    });
  }

  approve(app: OwnerApplication) {
    if (this.processingAction) return;

    this.processingAction = true;
    this.approveUseCase.execute(app.ownerApplicationId).subscribe({
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
        this.processingAction = false;
      },
      error: (err) => {
        console.error(err);
        const errMsg = err.error?.message || 'Có lỗi xảy ra trong quá trình phê duyệt đơn.';
        this.snackBar.open(errMsg, 'Đóng', {
          duration: 4000
        });
        this.processingAction = false;
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
        this.rejectUseCase.execute(app.ownerApplicationId, reason).subscribe({
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
            this.processingAction = false;
          },
          error: (err) => {
            console.error(err);
            const errMsg = err.error?.message || 'Có lỗi xảy ra trong quá trình từ chối đơn.';
            this.snackBar.open(errMsg, 'Đóng', {
              duration: 4000
            });
            this.processingAction = false;
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
