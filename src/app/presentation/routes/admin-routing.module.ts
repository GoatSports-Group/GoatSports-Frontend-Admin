import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from '@presentation/layouts/admin.component';
import { DashboardOverviewComponent } from '@presentation/pages/dashboard/dashboard.component';
import { UsersComponent } from '@presentation/pages/users/users.component';
import { RolesComponent } from '@presentation/pages/roles/roles.component';
import { AssignPermissionsComponent } from '@presentation/pages/roles/assign-permissions/assign-permissions.component';
import { PermissionsComponent } from '@presentation/pages/permissions/permissions.component';
import { VenuesComponent } from '@presentation/pages/venues/venues.component';
import { BookingsComponent } from '@presentation/pages/bookings/bookings.component';
import { ReviewsComponent } from '@presentation/pages/reviews/reviews.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      { path: 'dashboard', component: DashboardOverviewComponent },
      { path: 'venues', component: VenuesComponent },
      { path: 'bookings', component: BookingsComponent },
      { path: 'reviews', component: ReviewsComponent },
      { path: 'users', component: UsersComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'roles/:id/permissions', component: AssignPermissionsComponent },
      { path: 'permissions', component: PermissionsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
