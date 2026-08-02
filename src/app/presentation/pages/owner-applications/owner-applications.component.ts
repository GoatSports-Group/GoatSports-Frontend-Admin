import { Component, OnInit, inject } from '@angular/core';
import { GetAllOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-all-owner-applications.usecase';
import { GetOwnerApplicationDetailUseCase } from '@application/usecase/owner-application/get-owner-application-detail.usecase';
import { ApproveOwnerApplicationUseCase } from '@application/usecase/owner-application/approve-owner-application.usecase';
import { RejectOwnerApplicationUseCase } from '@application/usecase/owner-application/reject-owner-application.usecase';
import { OwnerApplication, OWNER_APPLICATION_STATUS_OPTIONS, BUSINESS_TYPE_OPTIONS, DOCUMENT_TYPE_OPTIONS, OwnerApplicationStatus, BusinessType, DocumentType } from '@application/dto/owner-application/owner-application.dto';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RejectReasonDialogComponent } from '@presentation/pages/owner-applications/owner-application-dialog/reject-reason-dialog.component';
import { PageEvent } from '@angular/material/paginator';
import { buildRsqlSearch } from '@shared/utils/api.helper';
import { GetFileUrlUseCase } from '@application/usecase/owner-application/get-file-url.usecase';
import { DocumentPreviewDialogComponent } from '@presentation/pages/owner-applications/document-preview-dialog/document-preview-dialog.component';

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
  private getFileUrlUseCase = inject(GetFileUrlUseCase);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  readonly OwnerApplicationStatus = OwnerApplicationStatus;
  readonly OwnerApplicationStatusOp = OWNER_APPLICATION_STATUS_OPTIONS;
  readonly BusinessTypeOp = BUSINESS_TYPE_OPTIONS;
  readonly DocumentTypeOp = DOCUMENT_TYPE_OPTIONS;

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
    const filterQuery = this.buildFilterQuery();

    this.getAllUseCase.execute({
      page: this.pageIndex,
      size: this.pageSize,
      filter: filterQuery
    }).subscribe({
      next: (response) => {
        this.filteredApplications = this.sortApplications(response.result);

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

  buildFilterQuery(): string {
    const parts: string[] = [];

    if (this.filterStatus && this.filterStatus !== 'ALL') {
      parts.push(`status : '${this.filterStatus}'`);
    }

    const searchPart = buildRsqlSearch(this.searchQuery, ['fullName', 'email', 'phone']);
    if (searchPart) {
      parts.push(`(${searchPart})`);
    }
    return parts.join(' and ');
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

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadApplications();
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

  getStatusLabel(status: OwnerApplicationStatus): string {
    return OWNER_APPLICATION_STATUS_OPTIONS.find(o => o.value === status)?.label || status;
  }

  getDocumentTypeLabel(type: DocumentType): string {
    return DOCUMENT_TYPE_OPTIONS.find(o => o.value === type)?.label || type;
  }

  getBusinessTypeLabel(type: BusinessType): string {
    return BUSINESS_TYPE_OPTIONS.find(o => o.value === type)?.label || type;
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

        this.filteredApplications = this.sortApplications(
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

            this.filteredApplications = this.sortApplications(
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

  openDocument(fileUrlOrKey: string): void {
    if (fileUrlOrKey.startsWith('http://') || fileUrlOrKey.startsWith('https://') || fileUrlOrKey.startsWith('data:image')) {
      window.open(fileUrlOrKey, '_blank');
      return;
    }

    this.getFileUrlUseCase.execute(fileUrlOrKey).subscribe({
      next: (presignedUrl) => {
        if (presignedUrl) {
          window.open(presignedUrl, '_blank');
        } else {
          this.snackBar.open('Không thể sinh link tải file!', 'Đóng', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Có lỗi xảy ra khi lấy link file!', 'Đóng', { duration: 3000 });
      }
    });
  }

  viewDocument(doc: any): void {
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

  /** Returns true for any ID-card variant */
  isIdCardDoc(doc: any): boolean {
    const t: string = doc?.documentType || '';
    return t === 'ID_CARD' || t === 'ID_CARD_FRONT' || t === 'ID_CARD_BACK';
  }

  /** All CCCD documents in the list */
  getIdCardDocs(docs: any[]): any[] {
    return (docs || []).filter(d => this.isIdCardDoc(d));
  }

  /** All non-CCCD documents in the list */
  getNonIdCardDocs(docs: any[]): any[] {
    return (docs || []).filter(d => !this.isIdCardDoc(d));
  }

  /** Open multi-image dialog for all CCCD docs */
  viewIdCardDocuments(docs: any[]): void {
    this.dialog.open(DocumentPreviewDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      disableClose: false,
      panelClass: 'custom-premium-dialog',
      data: {
        title: 'Căn Cước Công Dân (CCCD)',
        fileUrls: docs.map(d => d.fileUrl),
        fileLabels: docs.map((d, i) => {
          if (d.documentType === 'ID_CARD_FRONT') return 'Mặt trước CCCD';
          if (d.documentType === 'ID_CARD_BACK') return 'Mặt sau CCCD';
          return `Ảnh CCCD ${i + 1}`;
        })
      }
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }

  get pages(): number[] {
    const pagesArray = [];
    for (let i = 0; i < this.totalPages; i++) {
      pagesArray.push(i);
    }
    return pagesArray;
  }

  onPrevPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex--;
      this.loadApplications();
    }
  }

  onNextPage(): void {
    if ((this.pageIndex + 1) < this.totalPages) {
      this.pageIndex++;
      this.loadApplications();
    }
  }

  goToPage(page: number): void {
    this.pageIndex = page;
    this.loadApplications();
  }

  getShowingText(): string {
    if (this.totalItems === 0) {
      return 'Xem 0 - 0 trong 0 kết quả';
    }
    const start = this.pageIndex * this.pageSize + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.totalItems);
    return `Xem ${start} - ${end} trong ${this.totalItems} kết quả`;
  }
}
