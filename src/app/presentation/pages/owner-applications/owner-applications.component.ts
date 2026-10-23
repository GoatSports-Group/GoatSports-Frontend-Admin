import { PAGE_SIZE } from '@shared/constants/page-size';
import { ExternalVenueClaimReview, OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { TwoWayWindow } from '@shared/utils/two-way-window';
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
  private applicationRepository = inject(OWNER_APPLICATION_REPOSITORY_TOKEN);
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

  /** Các trang đã tải, nối dần khi cuộn xuống; chỉ render một cửa sổ (TwoWayWindow) để DOM không phình. */
  private readonly applications = signal<OwnerApplication[]>([]);
  readonly listWindow = new TwoWayWindow(this.applications, app => app.ownerApplicationId, inject(Injector));
  @ViewChild('applicationList') private applicationList?: ElementRef<HTMLElement>;
  loadingMore = false;

  get filteredApplications(): OwnerApplication[] { return this.applications(); }
  set filteredApplications(value: OwnerApplication[]) { this.applications.set(value); }
  get hasMoreOnServer(): boolean { return this.applications().length < this.totalItems; }
  selectedApplication: OwnerApplication | null = null;
  /** Khối "Nhận quản lý sân có sẵn" của hồ sơ đang xem; null với hồ sơ tạo cơ sở mới thường. */
  claimReview: ExternalVenueClaimReview | null = null;

  loadingList = false;
  loadingDetail = false;
  processingAction = false;

  filterStatus: string = 'ALL';
  searchQuery = '';

  totalItems = 0;
  pageSize = PAGE_SIZE.table;
  pageIndex = 0;

  ngOnInit() {
    this.searchChanges.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.loadApplications());
    this.loadApplications();
  }

  loadApplications() {
    this.listSubscription?.unsubscribe();
    this.loadingList = true;
    this.loadingMore = false;
    this.pageIndex = 0;
    this.listWindow.reset();
    this.applicationList?.nativeElement.scrollTo({ top: 0 });
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
    this.loadApplications();
  }

  /** Chạm đáy: hiện tiếp phần đã tải; hết thì tải trang kế tiếp từ server rồi hiện. */
  showMoreApplications(): void {
    const list = this.applicationList?.nativeElement;
    if (this.listWindow.hasAfter()) { this.listWindow.next(list); return; }
    if (!this.hasMoreOnServer || this.loadingMore || this.loadingList) return;
    this.loadingMore = true;
    this.listSubscription = this.getAllUseCase.execute({
      page: this.pageIndex + 1,
      size: this.pageSize,
      filter: buildOwnerApplicationFilter(this.filterStatus, this.searchQuery)
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.loadingMore = false; this.changeDetectorRef.markForCheck(); })
    ).subscribe({
      next: response => {
        const known = new Set(this.applications().map(app => app.ownerApplicationId));
        const fresh = (response?.result ?? []).filter(app => !known.has(app.ownerApplicationId));
        this.pageIndex++;
        this.totalItems = response?.meta?.total ?? this.totalItems;
        this.applications.update(list => [...list, ...sortOwnerApplications(fresh)]);
        this.listWindow.next(list);
      },
      error: () => this.snackBar.open('Không tải thêm được hồ sơ.', 'Đóng', { duration: 4000 })
    });
  }

  showPreviousApplications(): void {
    this.listWindow.previous(this.applicationList?.nativeElement);
  }

  onSearchChange() {
    this.searchChanges.next();
  }

  selectApplication(app: OwnerApplication) {
    this.detailSubscription?.unsubscribe();
    this.selectedApplication = app;
    this.claimReview = null;
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
          if (fullDetails.claimedExternalVenueId) this.loadClaimReview(selectedId);
        }
      },
      error: (err) => {
        console.error('Failed to load application details', err);
      }
    });
  }

  private loadClaimReview(applicationId: string): void {
    this.applicationRepository.getExternalVenueClaim(applicationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: review => {
        if (this.selectedApplication?.ownerApplicationId !== applicationId) return;
        this.claimReview = review;
        this.changeDetectorRef.markForCheck();
      },
      error: error => console.warn('Failed to load external venue claim:', error)
    });
  }

  /** Khoảng cách dễ đọc: "40 m" / "1,2 km". */
  claimDistanceLabel(meters: number): string {
    return meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
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

}
