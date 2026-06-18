import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from '../layouts/admin.component';
import { DashboardOverviewComponent } from '../pages/dashboard/dashboard.component';
import { UsersComponent } from '../pages/users/users.component';
import { RolesComponent } from '../pages/roles/roles.component';
import { AssignPermissionsComponent } from '../pages/roles/assign-permissions/assign-permissions.component';
import { PermissionsComponent } from '../pages/permissions/permissions.component';
import { VenuesComponent } from '../pages/venues/venues.component';
import { BookingsComponent } from '../pages/bookings/bookings.component';
import { ReviewsComponent } from '../pages/reviews/reviews.component';

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
