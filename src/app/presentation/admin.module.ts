import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { AdminRoutingModule } from '@presentation/routes/admin-routing.module';

// Layout & Standalone Components
import { AdminComponent } from '@shared/layouts/admin/admin.component';
import { DashboardOverviewComponent } from '@presentation/pages/dashboard/dashboard.component';
import { UsersComponent } from '@presentation/pages/users/users.component';
import { AssignRoleDialogComponent } from '@presentation/pages/users/assign-role-dialog/assign-role-dialog.component';
import { RolesComponent } from '@presentation/pages/roles/roles.component';
import { RoleDialogComponent } from '@presentation/pages/roles/role-dialog/role-dialog.component';
import { AssignPermissionsComponent } from '@presentation/pages/roles/assign-permissions/assign-permissions.component';
import { RolePermissionsDialogComponent } from '@presentation/pages/roles/role-permissions-dialog/role-permissions-dialog.component';
import { OwnerApplicationsComponent } from '@presentation/pages/owner-applications/owner-applications.component';
import { DocumentPreviewDialogComponent } from '@presentation/pages/owner-applications/document-preview-dialog/document-preview-dialog.component';
import { LogsComponent } from '@presentation/pages/logs/logs.component';
import { StatusBadgeComponent } from '@shared/components/ui/status-badge/status-badge.component';
import { OverviewStatsComponent } from '@presentation/pages/logs/components/overview-stats/overview-stats.component';
import { LogFilterComponent } from '@presentation/pages/logs/components/log-filter/log-filter.component';
import { LogTableComponent } from '@presentation/pages/logs/components/log-table/log-table.component';

// Users page child subcomponents
import { UserDetailsComponent } from '@presentation/pages/users/user-details/user-details.component';
import { CreateUserDrawerComponent } from '@presentation/pages/users/create-user-drawer/create-user-drawer.component';
import { EditUserDrawerComponent } from '@presentation/pages/users/edit-user-drawer/edit-user-drawer.component';
import { ChangePasswordDrawerComponent } from '@presentation/pages/users/change-password-drawer/change-password-drawer.component';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';

@NgModule({
  declarations: [
    UsersComponent,
    AssignRoleDialogComponent,
    RolesComponent,
    RoleDialogComponent,
    AssignPermissionsComponent,
    RolePermissionsDialogComponent,
    OwnerApplicationsComponent,
    DocumentPreviewDialogComponent,
    LogsComponent,
    UserDetailsComponent,
    CreateUserDrawerComponent,
    EditUserDrawerComponent,
    ChangePasswordDrawerComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    AdminRoutingModule,
    AdminComponent,
    DashboardOverviewComponent,
    StatusBadgeComponent,
    DragDropModule,
    OverlayModule,
    OverviewStatsComponent,
    LogFilterComponent,
    LogTableComponent
  ]
})
export class AdminModule { }
