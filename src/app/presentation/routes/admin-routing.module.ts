import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from '@shared/layouts/admin/admin.component';
import { DashboardOverviewComponent } from '@presentation/pages/dashboard/dashboard.component';
import { UsersComponent } from '@presentation/pages/users/users.component';
import { RolesComponent } from '@presentation/pages/roles/roles.component';
import { AssignPermissionsComponent } from '@presentation/pages/roles/assign-permissions/assign-permissions.component';
import { OwnerApplicationsComponent } from '@presentation/pages/owner-applications/owner-applications.component';
import { LogsComponent } from '@presentation/pages/logs/logs.component';
import { AdminBookingsComponent } from '@presentation/pages/bookings/bookings.component';
import { AdminGuard } from '@presentation/guards/admin.guard';
import { OwnerFeaturePlaceholderComponent } from '@presentation/pages/venue-owner-dashboard/owner-feature-placeholder/owner-feature-placeholder.component';
import { VenueOwnerApplicationsComponent } from '@presentation/pages/venue-owner-applications/venue-owner-applications.component';
import { OwnerVenueManagementComponent } from '@presentation/pages/owner-venue-management/owner-venue-management.component';
import { OwnerCourtManagementComponent } from '@presentation/pages/owner-court-management/owner-court-management.component';
import { OwnerScheduleComponent } from '@presentation/pages/owner-schedule/owner-schedule.component';
import { OwnerBookingsComponent } from '@presentation/pages/owner-bookings/owner-bookings.component';
import { OwnerCheckInComponent } from '@presentation/pages/owner-check-in/owner-check-in.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: 'dashboard',
        component: DashboardOverviewComponent,
        canActivate: [AdminGuard],
        data: { allowedRoles: ['ADMIN', 'VENUE_OWNER'] }
      },
      { path: 'bookings', component: AdminBookingsComponent, canActivate: [AdminGuard], data: { allowedRoles: ['ADMIN'] } },
      { path: 'owner-applications', component: OwnerApplicationsComponent, canActivate: [AdminGuard], data: { allowedRoles: ['ADMIN'] } },
      { path: 'applications', component: VenueOwnerApplicationsComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'] } },
      { path: 'users', component: UsersComponent, canActivate: [AdminGuard], data: { allowedRoles: ['ADMIN'] } },
      { path: 'roles', component: RolesComponent, canActivate: [AdminGuard], data: { allowedRoles: ['ADMIN'] } },
      { path: 'roles/:id/permissions', component: AssignPermissionsComponent, canActivate: [AdminGuard], data: { allowedRoles: ['ADMIN'] } },
      { path: 'logs', component: LogsComponent, canActivate: [AdminGuard], data: { allowedRoles: ['ADMIN'] } },
      { path: 'venues', component: OwnerVenueManagementComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'] } },
      { path: 'courts', component: OwnerCourtManagementComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'] } },
      { path: 'schedule', component: OwnerScheduleComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'] } },
      { path: 'owner-bookings', component: OwnerBookingsComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'] } },
      { path: 'check-in', component: OwnerCheckInComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'] } },
      { path: 'finance', component: OwnerFeaturePlaceholderComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'], featureId: 'finance' } },
      { path: 'reviews', component: OwnerFeaturePlaceholderComponent, canActivate: [AdminGuard], data: { allowedRoles: ['VENUE_OWNER'], featureId: 'reviews' } },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
