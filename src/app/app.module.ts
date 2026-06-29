import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ApiInterceptor } from '@presentation/interceptors/api.interceptor';
import { ForbiddenComponent } from '@shared/components/forbidden/forbidden.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { PERMISSION_REPOSITORY_TOKEN } from '@application/ports/persistence/permission.repository';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { REVIEW_REPOSITORY_TOKEN } from '@application/ports/persistence/review.repository';
import { VENUE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue.repository';
import { OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';

import { AuthRepositoryImpl } from '@infrastructure/repositories/auth.repository.impl';
import { UserRepositoryImpl } from '@infrastructure/repositories/user.repository.impl';
import { RoleRepositoryImpl } from '@infrastructure/repositories/role.repository.impl';
import { PermissionRepositoryImpl } from '@infrastructure/repositories/permission.repository.impl';
import { BookingRepositoryImpl } from '@infrastructure/repositories/booking.repository.impl';
import { ReviewRepositoryImpl } from '@infrastructure/repositories/review.repository.impl';
import { VenueRepositoryImpl } from '@infrastructure/repositories/venue.repository.impl';
import { OwnerApplicationRepositoryImpl } from '@infrastructure/repositories/owner-application.repository.impl';
import { NotificationRepositoryImpl } from '@infrastructure/repositories/notification.repository.impl';
import { StompWebSocketService } from '@infrastructure/websocket/stomp-websocket.service';

@NgModule({
  declarations: [
    AppComponent,
    ForbiddenComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    },
    { provide: AUTH_REPOSITORY_TOKEN, useClass: AuthRepositoryImpl },
    { provide: USER_REPOSITORY_TOKEN, useClass: UserRepositoryImpl },
    { provide: ROLE_REPOSITORY_TOKEN, useClass: RoleRepositoryImpl },
    { provide: PERMISSION_REPOSITORY_TOKEN, useClass: PermissionRepositoryImpl },
    { provide: BOOKING_REPOSITORY_TOKEN, useClass: BookingRepositoryImpl },
    { provide: REVIEW_REPOSITORY_TOKEN, useClass: ReviewRepositoryImpl },
    { provide: VENUE_REPOSITORY_TOKEN, useClass: VenueRepositoryImpl },
    { provide: OWNER_APPLICATION_REPOSITORY_TOKEN, useClass: OwnerApplicationRepositoryImpl },
    { provide: NOTIFICATION_REPOSITORY_TOKEN, useClass: NotificationRepositoryImpl },
    { provide: WEBSOCKET_SERVICE_TOKEN, useClass: StompWebSocketService }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
