import { Injectable, inject, Injector } from '@angular/core';
import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '@presentation/services/auth.service';

const AUTH_RETRY = new HttpContextToken<boolean>(() => false);

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private readonly injector = inject(Injector);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const credentialRequest = request.clone({ withCredentials: true });

    if (this.isRefreshRequest(request)) {
      return next.handle(credentialRequest).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) this.injector.get(AuthService).performLogout();
          return throwError(() => error);
        })
      );
    }

    if (this.isPublicAuthRequest(request) || request.context.get(AUTH_RETRY)) {
      return next.handle(credentialRequest);
    }

    return next.handle(credentialRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        if (!this.isAuthenticationFailure(error)) return throwError(() => error);
        return this.refreshAndRetry(credentialRequest, next);
      })
    );
  }

  private refreshAndRetry(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const authService = this.injector.get(AuthService);
    return authService.refresh().pipe(
      catchError(error => {
        authService.performLogout();
        return throwError(() => error);
      }),
      // Nhường một macrotask để trình duyệt hoàn tất ghi Set-Cookie trước khi
      // phát lại request vừa thất bại.
      switchMap(() => timer(0)),
      switchMap(() => next.handle(request.clone({
        context: request.context.set(AUTH_RETRY, true),
        withCredentials: true
      })))
    );
  }

  private isRefreshRequest(request: HttpRequest<unknown>): boolean {
    return request.url.includes('/auth-service/api/v1/auth/refresh');
  }

  private isAuthenticationFailure(error: HttpErrorResponse): boolean {
    // Gateway trả 401 khi JWT hết hạn; một số downstream security filter hiện
    // trả 403 khi request không còn authentication context. Request đã retry
    // được đánh dấu bằng HttpContext nên 403 phân quyền thật không tạo vòng lặp.
    return error.status === 401 || error.status === 403;
  }

  private isPublicAuthRequest(request: HttpRequest<unknown>): boolean {
    return [
      '/auth-service/api/v1/auth/login',
      '/auth-service/api/v1/auth/register',
      '/auth-service/api/v1/auth/verify',
      '/auth-service/api/v1/auth/resend',
      '/auth-service/api/v1/auth/forgot-password'
    ].some(endpoint => request.url.includes(endpoint));
  }
}
