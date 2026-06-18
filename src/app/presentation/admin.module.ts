import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { AdminRoutingModule } from './routes/admin-routing.module';

// Layout & Components
import { AdminComponent } from './layouts/admin.component';
import { DashboardOverviewComponent } from './pages/dashboard/dashboard.component';
import { UsersComponent } from './pages/users/users.component';
import { AssignRoleDialogComponent } from './pages/users/assign-role-dialog/assign-role-dialog.component';
import { RolesComponent } from './pages/roles/roles.component';
import { RoleDialogComponent } from './pages/roles/role-dialog/role-dialog.component';
import { AssignPermissionsComponent } from './pages/roles/assign-permissions/assign-permissions.component';
import { PermissionsComponent } from './pages/permissions/permissions.component';
import { PermissionDialogComponent } from './pages/permissions/permission-dialog/permission-dialog.component';
import { VenuesComponent } from './pages/venues/venues.component';
import { BookingsComponent } from './pages/bookings/bookings.component';
import { ReviewsComponent } from './pages/reviews/reviews.component';

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
    VenuesComponent,
    BookingsComponent,
    ReviewsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    AdminRoutingModule
  ]
})
export class AdminModule { }
