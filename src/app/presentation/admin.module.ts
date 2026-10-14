import { WheelScrollXDirective } from '@shared/directives/wheel-scroll-x.directive';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { AdminRoutingModule } from '@presentation/routes/admin-routing.module';

// Layout & Standalone Components
import { AdminComponent } from '@shared/layouts/admin/admin.component';
import { DashboardOverviewComponent } from '@presentation/pages/dashboard/dashboard.component';
import { UsersComponent } from '@presentation/pages/users/users.component';
import { RolesComponent } from '@presentation/pages/roles/roles.component';
import { OwnerApplicationsComponent } from '@presentation/pages/owner-applications/owner-applications.component';
import { DocumentPreviewDialogComponent } from '@presentation/pages/owner-applications/document-preview-dialog/document-preview-dialog.component';
import { LogsComponent } from '@presentation/pages/logs/logs.component';
import { AdminBookingsComponent } from '@presentation/pages/bookings/bookings.component';
import { PlatformVenuesComponent } from '@presentation/pages/platform-venues/platform-venues.component';
import { PlatformReviewsComponent } from '@presentation/pages/platform-reviews/platform-reviews.component';
import { StatusBadgeComponent } from '@shared/components/ui/status-badge/status-badge.component';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';

@NgModule({
  declarations: [
    OwnerApplicationsComponent,
    DocumentPreviewDialogComponent
  ],
  imports: [
    InfiniteScrollDirective,
    WheelScrollXDirective,
    CommonModule,
    SharedModule,
    AdminRoutingModule,
    AdminComponent,
    DashboardOverviewComponent,
    StatusBadgeComponent,
    DragDropModule,
    OverlayModule,
    LogsComponent,
    AdminBookingsComponent,
    PlatformVenuesComponent,
    PlatformReviewsComponent,
    UsersComponent,
    RolesComponent
  ]
})
export class AdminModule { }
