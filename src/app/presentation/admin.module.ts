import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@shared/shared.module';
import { AdminRoutingModule } from '@presentation/routes/admin-routing.module';

// Layout & Components
import { AdminComponent } from '@presentation/layouts/admin.component';
import { DashboardOverviewComponent } from '@presentation/pages/dashboard/dashboard.component';
import { UsersComponent } from '@presentation/pages/users/users.component';
import { AssignRoleDialogComponent } from '@presentation/pages/users/assign-role-dialog/assign-role-dialog.component';
import { RolesComponent } from '@presentation/pages/roles/roles.component';
import { RoleDialogComponent } from '@presentation/pages/roles/role-dialog/role-dialog.component';
import { AssignPermissionsComponent } from '@presentation/pages/roles/assign-permissions/assign-permissions.component';
import { PermissionsComponent } from '@presentation/pages/permissions/permissions.component';
import { PermissionDialogComponent } from '@presentation/pages/permissions/permission-dialog/permission-dialog.component';
import { OwnerApplicationsComponent } from '@presentation/pages/owner-applications/owner-applications.component';
import { DocumentPreviewDialogComponent } from '@presentation/pages/owner-applications/document-preview-dialog/document-preview-dialog.component';

@NgModule({
  declarations: [
    AdminComponent,
    DashboardOverviewComponent,
    UsersComponent,
    AssignRoleDialogComponent,
    RolesComponent,
    RoleDialogComponent,
    AssignPermissionsComponent,
    PermissionsComponent,
    PermissionDialogComponent,
    OwnerApplicationsComponent,
    DocumentPreviewDialogComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    AdminRoutingModule
  ]
})
export class AdminModule { }
