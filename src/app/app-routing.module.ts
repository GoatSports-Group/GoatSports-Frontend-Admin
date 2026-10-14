import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminGuard } from '@presentation/guards/admin.guard';
import { ForbiddenComponent } from '@shared/components/forbidden/forbidden.component';

const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('@presentation/admin.module').then(m => m.AdminModule),
    canActivate: [AdminGuard],
    // Cổng vào khu quản trị: chủ sân và mọi vai trò back-office (ADMIN + vai trò tự tạo). Từng trang con kiểm quyền riêng.
    data: { allowedRoles: ['VENUE_OWNER'], allowBackOffice: true }
  },
  {
    path: 'forbidden',
    component: ForbiddenComponent
  },
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'admin'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
