import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.authService.sessionReady$.pipe(
      filter(ready => ready === true),
      take(1),
      map(() => {
        if (!this.authService.isAuthenticated) {
          const adminUrl = import.meta.env.NG_APP_ADMIN_API_URL;
          const authUrl = import.meta.env.NG_APP_AUTH_API_URL;
          const redirectUrl = encodeURIComponent(`${adminUrl}/admin`);
          window.location.href = `${authUrl}/login?redirect=${redirectUrl}`;
          return false;
        }

        const roleName = this.authService.currentUser?.role?.name?.toUpperCase();
        if (roleName === 'ADMIN') {
          return true;
        }

        this.snackBar.open('Bạn không có quyền truy cập vào trang quản trị!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });

        this.router.navigate(['/forbidden']);
        return false;
      })
    );
  }
}
