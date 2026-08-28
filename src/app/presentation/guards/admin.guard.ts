import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { environment } from "@environments/environment"

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

        const roleName = this.authService.currentUser?.role?.name?.toUpperCase() ?? '';
        const allowedRoles = (route.data['allowedRoles'] as string[] | undefined) ?? ['ADMIN'];
        if (allowedRoles.includes(roleName)) {
          return true;
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
