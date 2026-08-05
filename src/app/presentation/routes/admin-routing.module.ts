import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from '@shared/layouts/admin/admin.component';
import { DashboardOverviewComponent } from '@presentation/pages/dashboard/dashboard.component';
import { UsersComponent } from '@presentation/pages/users/users.component';
import { RolesComponent } from '@presentation/pages/roles/roles.component';
import { AssignPermissionsComponent } from '@presentation/pages/roles/assign-permissions/assign-permissions.component';
import { OwnerApplicationsComponent } from '@presentation/pages/owner-applications/owner-applications.component';
import { LogsComponent } from '@presentation/pages/logs/logs.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      { path: 'dashboard', component: DashboardOverviewComponent },
      { path: 'owner-applications', component: OwnerApplicationsComponent },
      { path: 'users', component: UsersComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'roles/:id/permissions', component: AssignPermissionsComponent },
      { path: 'logs', component: LogsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
