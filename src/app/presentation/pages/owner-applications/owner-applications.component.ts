import { Component, OnInit, inject } from '@angular/core';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { GetOwnerApplicationDetailUseCase } from '@application/usecase/owner-application/get-owner-application-detail.usecase';
import { ApproveOwnerApplicationUseCase } from '@application/usecase/owner-application/approve-owner-application.usecase';
import { RejectOwnerApplicationUseCase } from '@application/usecase/owner-application/reject-owner-application.usecase';
import { OwnerApplication, OWNER_APPLICATION_STATUS_OPTIONS, BUSINESS_TYPE_OPTIONS, DOCUMENT_TYPE_OPTIONS, OwnerApplicationStatus, BusinessType, DocumentType } from '@application/dto/owner-application/owner-application.dto';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RejectReasonDialogComponent } from '@presentation/pages/owner-applications/owner-application-dialog/reject-reason-dialog.component';

@Component({
  selector: 'app-admin-owner-applications',
  templateUrl: './owner-applications.component.html',
  styleUrls: ['./owner-applications.component.scss']
})
export class OwnerApplicationsComponent implements OnInit {
  private getAllUseCase = inject(GetAllOwnerApplicationsUseCase);
  private getDetailUseCase = inject(GetOwnerApplicationDetailUseCase);
  private approveUseCase = inject(ApproveOwnerApplicationUseCase);
  private rejectUseCase = inject(RejectOwnerApplicationUseCase);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  readonly OwnerApplicationStatusOp = OWNER_APPLICATION_STATUS_OPTIONS;
  readonly BusinessTypeOp = BUSINESS_TYPE_OPTIONS;
  readonly DocumentTypeOp = DOCUMENT_TYPE_OPTIONS;

  applications: OwnerApplication[] = [];
  filteredApplications: OwnerApplication[] = [];
  selectedApplication: OwnerApplication | null = null;

  loadingList = false;
  loadingDetail = false;
  processingAction = false;

  filterStatus: 'ALL' | OwnerApplicationStatus = 'ALL';
  searchQuery = '';
  readonly OwnerApplicationStatus = OwnerApplicationStatus;

  getStatusLabel(status: OwnerApplicationStatus): string {
    return OWNER_APPLICATION_STATUS_OPTIONS.find(o => o.value === status)?.label || status;
  }

  getDocumentTypeLabel(type: DocumentType): string {
    return DOCUMENT_TYPE_OPTIONS.find(o => o.value === type)?.label || type;
  }

  getBusinessTypeLabel(type: BusinessType): string {
    return BUSINESS_TYPE_OPTIONS.find(o => o.value === type)?.label || type;
  }

  ngOnInit() {
    this.loadApplications();
  }

  loadApplications() {
    this.loadingList = true;
    this.getAllUseCase.execute().subscribe({
      next: (data) => {
        this.applications = this.sortApplications(data);
        this.applyFilters();
        this.loadingList = false;

        const pending = this.filteredApplications.find(a => a.status === OwnerApplicationStatus.PENDING);
        if (pending) {
          this.selectApplication(pending);
        } else if (this.filteredApplications.length > 0) {
          this.selectApplication(this.filteredApplications[0]);
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

  sortApplications(list: OwnerApplication[]): OwnerApplication[] {
    return [...list].sort((a, b) => {
      if (a.status === OwnerApplicationStatus.PENDING && b.status !== OwnerApplicationStatus.PENDING) {
        return -1;
      }
      if (a.status !== OwnerApplicationStatus.PENDING && b.status === OwnerApplicationStatus.PENDING) {
        return 1;
      }
      return 0;
    });
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

  applyFilters() {
    this.filteredApplications = this.applications.filter(app => {
      const matchesStatus = this.filterStatus === 'ALL' || app.status === this.filterStatus;
      const query = this.searchQuery.toLowerCase().trim();
      const matchesSearch = !query ||
        app.fullName.toLowerCase().includes(query) ||
        app.businessName.toLowerCase().includes(query) ||
        app.email.toLowerCase().includes(query) ||
        app.phone.includes(query) ||
        app.taxCode.includes(query);

      return matchesStatus && matchesSearch;
    });
  }

  onFilterStatusChange(status: 'ALL' | OwnerApplicationStatus) {
    this.filterStatus = status;
    this.applyFilters();
  }

  onSearchChange() {
    this.applyFilters();
  }

  approve(app: OwnerApplication) {
    if (this.processingAction) return;

    this.processingAction = true;
    this.approveUseCase.execute(app.ownerApplicationId).subscribe({
      next: (updatedApp) => {
        this.snackBar.open(`Đã phê duyệt đơn đăng ký của ${app.fullName} thành công!`, 'Đóng', {
          duration: 5000
        });

        this.applications = this.sortApplications(
          this.applications.map(a => a.ownerApplicationId === app.ownerApplicationId ? updatedApp : a)
        );
        this.applyFilters();
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
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((reason: string | null) => {
      if (reason) {
        this.processingAction = true;
        this.rejectUseCase.execute(app.ownerApplicationId, reason).subscribe({
          next: (updatedApp) => {
            this.snackBar.open(`Đã từ chối đơn đăng ký của ${app.fullName}.`, 'Đóng', {
              duration: 5000
            });

            this.applications = this.sortApplications(
              this.applications.map(a => a.ownerApplicationId === app.ownerApplicationId ? updatedApp : a)
            );
            this.applyFilters();
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

  isImage(url: string): boolean {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.webp') ||
      cleanUrl.endsWith('.gif') ||
      url.startsWith('data:image');
  }
}
