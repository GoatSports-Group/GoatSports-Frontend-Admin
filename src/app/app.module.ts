import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ApiInterceptor } from '@presentation/interceptors/api.interceptor';
import { ForbiddenComponent } from '@shared/components/forbidden/forbidden.component';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotifyComponent } from '@shared/components/notify/notify.component';

import { AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { ROLE_REPOSITORY_TOKEN } from '@application/ports/persistence/role.repository';
import { PERMISSION_REPOSITORY_TOKEN } from '@application/ports/persistence/permission.repository';
import { OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { LOG_REPOSITORY_TOKEN } from '@application/ports/persistence/log.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';

import { AuthRepositoryImpl } from '@infrastructure/repositories/auth.repository.impl';
import { UserRepositoryImpl } from '@infrastructure/repositories/user.repository.impl';
import { StorageRepositoryImpl } from '@infrastructure/repositories/storage.repository.impl';
import { RoleRepositoryImpl } from '@infrastructure/repositories/role.repository.impl';
import { PermissionRepositoryImpl } from '@infrastructure/repositories/permission.repository.impl';
import { OwnerApplicationRepositoryImpl } from '@infrastructure/repositories/owner-application.repository.impl';
import { NotificationRepositoryImpl } from '@infrastructure/repositories/notification.repository.impl';
import { LogRepositoryImpl } from '@infrastructure/repositories/log.repository.impl';
import { StompWebSocketService } from '@infrastructure/websocket/stomp-websocket.service';
import { IMAGE_CONFIG } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import {
  provideLucideIcons,
  LucideMenu,
  LucideChevronRight,
  LucideChevronLeft,
  LucideSearch,
  LucideBell,
  LucideBellOff,
  LucideCheck,
  LucideX,
  LucideLayoutDashboard,
  LucideUserCheck,
  LucideUsers,
  LucideShield,
  LucideKey,
  LucideLogOut,
  LucideTrendingUp,
  LucideTrendingDown,
  LucideStar,
  LucideStarHalf,
  LucideBan,
  LucideActivity,
  LucideDownload,
  LucideFileText,
  LucideTable,
  LucideFilter,
  LucideUserCog,
  LucidePlus,
  LucidePencil,
  LucideTrash2,
  LucideUnlock,
  LucideArrowLeft,
  LucideSave,
  LucideCheckCircle,
  LucideClock,
  LucideArrowRight,
  LucideCalendar,
  LucideAlertTriangle,
  LucideUser,
  LucideMapPin,
  LucideCloud,
  LucideAlertCircle,
  LucideEye,
  LucideInfo,
  LucideExternalLink,
  LucideLandPlot,
  LucideCloudLightning,
  LucideDroplets,
  LucideShieldAlert,
  LucideMoreVertical,
  LucideTrash,
  LucideRotateCcw,
  LucideGripHorizontal,
  LucideUpload,
  LucideImage,
  LucideCamera,
  LucideEyeOff,
  LucideChevronDown,
  LucideGlobe,
  LucideLoader2,
  LucideMail,
  LucideHash,
  LucidePhone,
  LucideShieldCheck,
  LucideCreditCard,
  LucideShieldOff,
  LucideGauge,
  LucideTimer,
  LucideNetwork,
  LucideGripVertical,
  LucideLayoutGrid,
  LucideChevronsLeft,
  LucideChevronsRight,
  LucideSun,
  LucideUserRound,
  LucideClipboardCheck,
  LucideFolderOpen
} from '@lucide/angular';

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
    MatButtonModule,
    MatProgressSpinnerModule,
    LucideIconComponent,
    NotifyComponent
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    },
    { provide: AUTH_REPOSITORY_TOKEN, useClass: AuthRepositoryImpl },
    { provide: USER_REPOSITORY_TOKEN, useClass: UserRepositoryImpl },
    { provide: STORAGE_REPOSITORY_TOKEN, useClass: StorageRepositoryImpl },
    { provide: ROLE_REPOSITORY_TOKEN, useClass: RoleRepositoryImpl },
    { provide: PERMISSION_REPOSITORY_TOKEN, useClass: PermissionRepositoryImpl },
    { provide: OWNER_APPLICATION_REPOSITORY_TOKEN, useClass: OwnerApplicationRepositoryImpl },
    { provide: NOTIFICATION_REPOSITORY_TOKEN, useClass: NotificationRepositoryImpl },
    { provide: LOG_REPOSITORY_TOKEN, useClass: LogRepositoryImpl },
    { provide: WEBSOCKET_SERVICE_TOKEN, useClass: StompWebSocketService },
    {
      provide: IMAGE_CONFIG,
      useValue: {
        disableImageSizeWarning: true,
        disableImageLazyLoadWarning: true
      }
    },
    provideLucideIcons(
      LucideMenu,
      LucideChevronRight,
      LucideChevronLeft,
      LucideSearch,
      LucideBell,
      LucideBellOff,
      LucideCheck,
      LucideX,
      LucideLayoutDashboard,
      LucideUserCheck,
      LucideUsers,
      LucideShield,
      LucideKey,
      LucideLogOut,
      LucideTrendingUp,
      LucideTrendingDown,
      LucideStar,
      LucideStarHalf,
      LucideBan,
      LucideActivity,
      LucideDownload,
      LucideFileText,
      LucideTable,
      LucideFilter,
      LucideUserCog,
      LucidePlus,
      LucidePencil,
      LucideTrash2,
      LucideUnlock,
      LucideArrowLeft,
      LucideSave,
      LucideCheckCircle,
      LucideClock,
      LucideArrowRight,
      LucideCalendar,
      LucideAlertTriangle,
      LucideUser,
      LucideMapPin,
      LucideCloud,
      LucideAlertCircle,
      LucideEye,
      LucideInfo,
      LucideExternalLink,
      LucideLandPlot,
      LucideCloudLightning,
      LucideDroplets,
      LucideShieldAlert,
      LucideMoreVertical,
      LucideTrash,
      LucideRotateCcw,
      LucideGripHorizontal,
      LucideUpload,
      LucideImage,
      LucideCamera,
      LucideEyeOff,
      LucideChevronDown,
      LucideGlobe,
      LucideLoader2,
      LucideMail,
      LucideHash,
      LucidePhone,
      LucideShieldCheck,
      LucideCreditCard,
      LucideShieldOff,
      LucideGauge,
      LucideTimer,
      LucideNetwork,
      LucideGripVertical,
      LucideLayoutGrid,
      LucideChevronsLeft,
      LucideChevronsRight,
      LucideSun,
      LucideUserRound,
      LucideClipboardCheck,
      LucideFolderOpen
    )
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
