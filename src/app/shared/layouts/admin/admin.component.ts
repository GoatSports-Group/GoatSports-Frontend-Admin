import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, of } from 'rxjs';
import { startWith, switchMap, catchError, map } from 'rxjs/operators';

import { AuthService } from '@presentation/services/auth.service';
import { NotificationService } from '@presentation/services/notification.service';
import { User } from '@application/dto/user/user.dto';
import { Notification, NotificationType } from '@application/dto/notification/notification.dto';

import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { environment } from "@environments/environment"

type BallType = 'SOCCER' | 'BASKETBALL' | 'TENNIS' | 'TABLE_TENNIS' | 'BADMINTON' | 'VOLLEYBALL';

interface SportsParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  type: BallType;
  rotation: number;
  rotationSpeed: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatSidenavModule,
    LucideIconComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, AfterViewInit, OnDestroy {
  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiBase = environment.apiUrl;

  // Canvas Background Animation State
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D | null;
  private animationFrameId!: number;

  private mouseX = 0;
  private mouseY = 0;
  private currentVPX = 0;
  private currentVPY = 0;

  private particles: SportsParticle[] = [];
  private readonly particleCount = 20; // Lower count (20 instead of 40) is cleaner for workspace bg

  private readonly ballEmojis: Record<BallType, string> = {
    SOCCER: '⚽',
    BASKETBALL: '🏀',
    TENNIS: '🎾',
    TABLE_TENNIS: '🏓',
    BADMINTON: '🏸',
    VOLLEYBALL: '🏐'
  };

  private ballCache: Map<BallType, HTMLCanvasElement> = new Map();
  private readonly baseSpriteSize = 90;

  private resizeListener!: () => void;
  private mouseMoveListener!: (e: MouseEvent) => void;

  // Signals state management
  sidebarCollapsed = signal(false);
  isOnline = signal(true);
  searchQuery = signal('');
  isSearchOpen = signal(false);
  selectedSearchIndex = signal(0);

  searchItems = [
    {
      title: 'Tổng quan',
      description: 'Xem số liệu thống kê, dự báo thời tiết và phân tích hệ thống',
      icon: 'layout-dashboard',
      route: '/dashboard'
    },
    {
      title: 'Chủ Sân',
      description: 'Duyệt đơn đăng ký, quản lý hồ sơ và thông tin chủ sân thể thao',
      icon: 'land-plot',
      route: '/owner-applications',
    },
    {
      title: 'Người dùng',
      description: 'Quản lý tài khoản người dùng, phân vai trò thành viên hệ thống',
      icon: 'users',
      route: '/users',
    },
    {
      title: 'Vai trò',
      description: 'Quản lý các nhóm vai trò quyền hạn của quản trị viên',
      icon: 'shield',
      route: '/roles',
    },
    {
      title: 'Nhật ký hệ thống',
      description: 'Theo dõi và giám sát nhật ký hoạt động, lỗi hệ thống',
      icon: 'activity',
      route: '/logs',
    }
  ];

  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.searchItems;
    return this.searchItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ctrl+K or Cmd+K to open
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    }

    // Escape to close
    if (event.key === 'Escape' && this.isSearchOpen()) {
      event.preventDefault();
      this.closeSearch();
    }

    if (this.isSearchOpen()) {
      const items = this.filteredItems();
      if (items.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedSearchIndex.update(idx => (idx + 1) % items.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedSearchIndex.update(idx => (idx - 1 + items.length) % items.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this.selectSearchItem(items[this.selectedSearchIndex()]);
      }
    }
  }

  openSearch() {
    this.isSearchOpen.set(true);
    this.searchQuery.set('');

    try {
      if (this.router && this.router.url) {
        const currentUrl = this.router.url.split('?')[0]; // strip query parameters
        const activeIndex = this.searchItems.findIndex(item =>
          currentUrl === '/admin' + item.route || currentUrl.startsWith('/admin' + item.route + '/')
        );
        this.selectedSearchIndex.set(activeIndex !== -1 ? activeIndex : 0);
      } else {
        this.selectedSearchIndex.set(0);
      }
    } catch (error) {
      console.error('Error getting active search index:', error);
      this.selectedSearchIndex.set(0);
    }

    setTimeout(() => {
      const input = document.getElementById('search-palette-input') as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  }

  closeSearch() {
    this.isSearchOpen.set(false);
  }

  selectSearchItem(item: any) {
    this.router.navigate(["/admin" + item.route]);
    this.closeSearch();
  }

  userProfile: User | null = null;
  clientUrl = environment.clientApiUrl;
  private statusSub?: Subscription;

  notificationPage = 1;
  isNotificationLoading = false;

  ngOnInit() {
    this.userProfile = this.authService.currentUser;

    this.statusSub = interval(10000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get(`${this.apiBase}/auth-service/api/v1/auth/me`).pipe(
            map(() => true),
            catchError((err: any) => {
              const isReachable = err.status !== 0;
              return of(isReachable);
            })
          )
        )
      )
      .subscribe({
        next: (connected) => this.isOnline.set(connected),
        error: () => this.isOnline.set(false)
      });
  }

  ngAfterViewInit() {
    this.canvas = document.getElementById('admin-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.initCanvas();
      this.generateBallSprites();

      this.currentVPX = this.canvas.width / 2;
      this.currentVPY = this.canvas.height / 2;

      this.initParticles();
      this.animate();

      this.resizeListener = () => this.initCanvas();
      window.addEventListener('resize', this.resizeListener);

      this.mouseMoveListener = (e: MouseEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
      };
      window.addEventListener('mousemove', this.mouseMoveListener);
    }
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
    // Clean up canvas resources
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
    if (this.mouseMoveListener) window.removeEventListener('mousemove', this.mouseMoveListener);
  }

  private initCanvas() {
    const parent = this.canvas?.parentElement;
    if (parent && this.canvas) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }

  private generateBallSprites() {
    Object.entries(this.ballEmojis).forEach(([type, emoji]) => {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = this.baseSpriteSize;
      offCanvas.height = this.baseSpriteSize;
      const offCtx = offCanvas.getContext('2d');

      if (offCtx) {
        offCtx.font = `${this.baseSpriteSize * 0.75}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillText(emoji, this.baseSpriteSize / 2, this.baseSpriteSize / 2);
      }

      this.ballCache.set(type as BallType, offCanvas);
    });
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createRandomParticle(true));
    }
  }

  private createRandomParticle(randomZ = false): SportsParticle {
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 500;
    const ballTypes: BallType[] = ['SOCCER', 'BASKETBALL', 'TENNIS', 'TABLE_TENNIS', 'BADMINTON', 'VOLLEYBALL'];

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: randomZ ? Math.random() * 1000 : 1000,
      speed: 1.2 + Math.random() * 2.2,
      size: 20 + Math.random() * 22,
      type: ballTypes[Math.floor(Math.random() * ballTypes.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.025
    };
  }

  private animate() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const targetVPX = this.canvas.width / 2 + (this.mouseX - this.canvas.width / 2) * 0.15;
    const targetVPY = this.canvas.height / 2 + (this.mouseY - this.canvas.height / 2) * 0.15;

    this.currentVPX += (targetVPX - this.currentVPX) * 0.08;
    this.currentVPY += (targetVPY - this.currentVPY) * 0.08;

    // Ray ánh sáng nền
    this.ctx.lineWidth = 1.0;
    const rayCount = 14;
    for (let i = 0; i <= rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const targetX = this.currentVPX + Math.cos(angle) * Math.max(this.canvas.width, this.canvas.height) * 1.5;
      const targetY = this.currentVPY + Math.sin(angle) * Math.max(this.canvas.width, this.canvas.height) * 1.5;

      this.ctx.beginPath();
      this.ctx.moveTo(this.currentVPX, this.currentVPY);
      this.ctx.lineTo(targetX, targetY);
      this.ctx.strokeStyle = i % 2 === 0 ? 'rgba(16, 185, 129, 0.03)' : 'rgba(14, 165, 233, 0.02)';
      this.ctx.stroke();
    }

    // Render 3D Depth Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.z -= p.speed;
      p.rotation += p.rotationSpeed;

      if (p.z <= 0) {
        this.particles[i] = this.createRandomParticle(false);
        continue;
      }

      const fov = 350;
      const scale = fov / (p.z + 1);
      const screenX = this.currentVPX + p.x * scale;
      const screenY = this.currentVPY + p.y * scale;

      if (screenX >= -100 && screenX <= this.canvas.width + 100 && screenY >= -100 && screenY <= this.canvas.height + 100) {
        const renderSize = Math.max(8, p.size * scale);
        const sprite = this.ballCache.get(p.type);

        let alpha = 0.95;
        if (p.z > 800) alpha = (1000 - p.z) / 200;
        else if (p.z < 150) alpha = p.z / 150;

        if (sprite) {
          this.ctx.save();
          this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          this.ctx.translate(screenX, screenY);
          this.ctx.rotate(p.rotation);

          // Tạo hiệu ứng Depth of Field: Làm mờ nhẹ các quả bóng khi trôi sát mắt người xem (Z < 180)
          if (p.z < 180) {
            const blurAmount = ((180 - p.z) / 180) * 4;
            this.ctx.filter = `blur(${blurAmount}px)`;
          }

          // Hiệu ứng bóng đổ 3D theo chiều sâu
          this.ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
          this.ctx.shadowBlur = Math.max(3, 8 * scale);
          this.ctx.shadowOffsetX = Math.max(2, 4 * scale);
          this.ctx.shadowOffsetY = Math.max(3, 6 * scale);

          this.ctx.drawImage(
            sprite,
            -renderSize / 2,
            -renderSize / 2,
            renderSize,
            renderSize
          );

          this.ctx.restore();
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }


  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        const authUrl = environment.authApiUrl;
        window.location.href = `${authUrl}/login`;
      }
    });
  }

  isNotifOpen = false;

  toggleNotifDropdown(event: Event): void {
    event.stopPropagation();
    this.isNotifOpen = !this.isNotifOpen;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isNotifOpen = false;
  }

  onNotificationClick(notification: Notification) {
    this.isNotifOpen = false;
    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => {
        if (notification.type === NotificationType.OWNER_APPLICATION) {
          this.router.navigate(['/owner-applications']);
        }
      }
    });
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe({
      error: (err) => console.error('Failed to mark all as read:', err)
    });
  }

  deleteNotification(notification: Notification) {
    this.notificationService.deleteNotification(notification.notificationId).subscribe({
      error: (err) => console.error('Failed to delete notification:', err)
    });
  }

  onNotificationScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (!element) return;

    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (atBottom) {
      this.notificationService.loadNextPage();
    }
  }

  get fallbackAvatar(): string {
    return this.userProfile?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.userProfile.fullName)}`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80';
  }

  getRelativeTime(dateInput: any): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Fallback if system clock difference is slightly negative
    if (diffMs < 0) return 'Vừa xong';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Vừa xong';
    } else if (diffMins < 60) {
      return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else if (diffDays === 1) {
      return 'Hôm qua';
    } else {
      return `${diffDays} ngày trước`;
    }
  }
}
