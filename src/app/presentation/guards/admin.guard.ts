import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { environment } from "@environments/environment"
import {
  PLATFORM_ADMIN_NAVIGATION, canOpenPlatformItem, isBackOfficeRole, platformNavigationItem
} from '@presentation/shared/layouts/admin/admin-navigation.config';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(NotifyService);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.authService.sessionReady$.pipe(
      filter(ready => ready === true),
      take(1),
      map(() => {
        if (!this.authService.isAuthenticated) {
          const adminUrl = environment.adminApiUrl;
          const authUrl = environment.authApiUrl;
          const redirectUrl = encodeURIComponent(`${adminUrl}/admin`);
          window.location.href = `${authUrl}/login?redirect=${redirectUrl}`;
          return false;
        }

        const user = this.authService.currentUser;
        const roleName = user?.role?.name?.toUpperCase() ?? '';
        const allowedRoles = route.data['allowedRoles'] as string[] | undefined;
        const platformRoute = route.data['platformRoute'] as string | undefined;
        if (allowedRoles?.includes(roleName)) {
          return true;
        }
        // Trang nền tảng mở theo quyền: ADMIN mọi trang, vai trò tự tạo chỉ trang có quyền tương ứng.
        const item = platformRoute ? platformNavigationItem(platformRoute) : undefined;
        if (item && canOpenPlatformItem(item, roleName, user?.permissions)) {
          return true;
        }
        if (isBackOfficeRole(roleName)) {
          // Vào trang không có quyền (thường là /dashboard sau đăng nhập): sang trang đầu tiên được mở, không báo lỗi.
          const first = PLATFORM_ADMIN_NAVIGATION.find(entry => canOpenPlatformItem(entry, roleName, user?.permissions));
          if (first && first.route !== platformRoute) {
            this.router.navigate(['/admin' + first.route]);
            return false;
          }
        }

        this.snackBar.open('Bạn không có quyền truy cập khu vực này.', 'Đóng', {
          duration: 2000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });

        this.router.navigate(roleName === 'VENUE_OWNER' ? ['/admin/dashboard'] : ['/forbidden']);
        return false;
      })
    );
  }
}
