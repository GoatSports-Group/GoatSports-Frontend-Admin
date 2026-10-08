import {
  AfterViewChecked, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal, untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize, map, of, switchMap } from 'rxjs';
import { ChatMessage, ChatRoom } from '@application/dto/chat/chat.dto';
import { User } from '@application/dto/user/user.dto';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { OWNER_BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-booking.repository';
import { OWNER_TOURNAMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-tournament.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-owner-dashboard.repository';
import { SOCIAL_SOCKET_TOKEN } from '@application/ports/social-socket.service';
import { AuthService } from '@presentation/services/auth.service';
import { ChatInboxService, OWNER_ROOM_TYPES } from '@presentation/services/chat-inbox.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { PAGE_SIZE } from '@shared/constants/page-size';
import { CHAT_IMAGE_TYPES, CHAT_MAX_BYTES, CHAT_MAX_IMAGES, prepareImage } from '@shared/utils/image-prep';
import { getAvatarUrl } from '@shared/utils/user-display.utils';

const ROOM_PAGE = 20;
const MESSAGE_PAGE = PAGE_SIZE.chat;
const SUPPORT_AVATAR = 'assets/images/goat.png';

type OwnerFilter = 'ALL' | 'UNREAD' | 'CUSTOMER' | 'SUPPORT';
type AdminFilter = 'ALL' | 'AWAITING' | 'UNREAD';

/** San / giai / ve khach dang hoi (chat BUSINESS, phia chu san). */
interface SubjectCard { icon: string; kicker: string; title: string; meta: string; route: string; query?: Record<string, string>; }

interface Person { name: string; avatar: string; email?: string; phone?: string; }

/**
 * Tin nhan trong admin (GOAT-DESIGN §7 Messages, ban van hanh).
 * - Chu san: chat cong viec voi khach (nut "Nhan tin" o san / giai / ve ben client) va hop thu "Ho tro GOAT Sports".
 * - Admin: hop thu ho tro chung cua doi quan tri; mo mot doan chat la tham gia no. `?owner=<id>` mo / chu dong nhan
 *   cho mot chu san (tu trang Co so, Chu san).
 * Cuon hai chieu theo con tro, mo tai tin chua doc dau tien, gui chu va anh, cap nhat realtime qua social-service.
 */
@Component({
  selector: 'app-admin-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, RouterLink, LucideIconComponent, LoadingSkeletonComponent, InfiniteScrollDirective]
})
export class AdminMessagesComponent implements OnInit, AfterViewChecked, OnDestroy {
  private readonly chat = inject(CHAT_REPOSITORY_TOKEN);
  private readonly socket = inject(SOCIAL_SOCKET_TOKEN);
  private readonly users = inject(USER_REPOSITORY_TOKEN);
  private readonly storage = inject(STORAGE_REPOSITORY_TOKEN);
  private readonly venues = inject(VENUE_OWNER_DASHBOARD_REPOSITORY_TOKEN);
  private readonly bookings = inject(OWNER_BOOKING_REPOSITORY_TOKEN);
  private readonly tournaments = inject(OWNER_TOURNAMENT_REPOSITORY_TOKEN);
  private readonly inbox = inject(ChatInboxService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('thread') private threadRef?: ElementRef<HTMLElement>;
  @ViewChild('composer') private composerRef?: ElementRef<HTMLTextAreaElement>;

  readonly me = this.auth.currentUser?.userId ?? '';
  readonly isAdmin = this.auth.currentUser?.role?.name?.toUpperCase() === 'ADMIN';
  readonly maxImages = CHAT_MAX_IMAGES;
  readonly imageAccept = CHAT_IMAGE_TYPES.join(',') + ',image/heic,image/heif';

  readonly rooms = signal<ChatRoom[]>([]);
  readonly loadingRooms = signal(true);
  readonly roomsFailed = signal(false);
  readonly hasMoreRooms = signal(false);
  readonly loadingMoreRooms = signal(false);
  readonly search = signal('');
  readonly ownerFilter = signal<OwnerFilter>('ALL');
  readonly adminFilter = signal<AdminFilter>('ALL');
  readonly openingSupport = signal(false);

  readonly active = signal<ChatRoom | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly loadingMessages = signal(false);
  readonly messagesFailed = signal(false);
  readonly hasOlder = signal(false);
  readonly hasNewer = signal(false);
  readonly loadingOlder = signal(false);
  readonly loadingNewer = signal(false);
  readonly firstUnreadId = signal<string | null>(null);
  readonly newBelow = signal(0);
  readonly showJump = signal(false);

  readonly draft = signal('');
  readonly draftImages = signal<{ file: File; previewUrl: string }[]>([]);
  readonly preparingImages = signal(false);
  readonly imageUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly people = signal<ReadonlyMap<string, Person>>(new Map());
  readonly subject = signal<SubjectCard | null>(null);
  readonly contextOpen = signal(false);
  readonly confirmClear = signal(false);
  readonly clearing = signal(false);

  readonly ownerFilters: readonly { value: OwnerFilter; label: string }[] = [
    { value: 'ALL', label: 'Tất cả' }, { value: 'UNREAD', label: 'Chưa đọc' },
    { value: 'CUSTOMER', label: 'Khách hàng' }, { value: 'SUPPORT', label: 'Hỗ trợ' }
  ];
  readonly adminFilters: readonly { value: AdminFilter; label: string }[] = [
    { value: 'ALL', label: 'Tất cả' }, { value: 'AWAITING', label: 'Chờ trả lời' }, { value: 'UNREAD', label: 'Chưa đọc' }
  ];

  readonly visibleRooms = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.rooms().filter(room => {
      if (query && !`${this.roomName(room)} ${room.lastMessage ?? ''}`.toLowerCase().includes(query)) return false;
      if (this.isAdmin) {
        const filter = this.adminFilter();
        return filter === 'ALL' || (filter === 'AWAITING' ? room.awaitingReply : room.unreadCount > 0);
      }
      const filter = this.ownerFilter();
      return filter === 'ALL'
        || (filter === 'UNREAD' && room.unreadCount > 0)
        || (filter === 'CUSTOMER' && room.type === 'BUSINESS')
        || (filter === 'SUPPORT' && room.type === 'SUPPORT');
    });
  });

  /** Chu san chua tung nhan doi quan tri: hang ghim "Ho tro GOAT Sports" o dau danh sach. */
  readonly showSupportShortcut = computed(() => !this.isAdmin && !this.loadingRooms()
    && !this.rooms().some(room => room.type === 'SUPPORT') && this.ownerFilter() !== 'CUSTOMER' && !this.search().trim());

  readonly canSend = computed(() => !this.preparingImages() && (!!this.draft().trim() || this.draftImages().length > 0));

  private requestedRoomId: string | null = null;
  private roomsPage = 0;
  private messageSequence = 0;
  private keepScrollFrom: { height: number; top: number } | null = null;
  private scrollToUnread = false;
  private scrollBottom = false;
  private readonly requestedKeys = new Set<string>();
  private readonly requestedPeople = new Set<string>();
  private readonly outgoingFiles = new Map<string, File[]>();
  private readonly uploadedKeys = new Map<string, string[]>();
  private readonly localUrls = new Set<string>();
  /** Moi phong minh la thanh vien deu duoc nghe (tin moi + dang nhap), giong Tin nhan ben client. */
  private readonly listening = new Set<string>();
  /** Phong -> nguoi dang nhap (tru minh). Tu xoa sau 4,5s neu khong nhan duoc "ngung nhap". */
  readonly typing = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private typingRoom: string | null = null;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const messages = this.messages();
      untracked(() => this.resolveImageUrls(messages));
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.requestedRoomId = params.get('room');
      const ownerId = params.get('owner');
      if (ownerId && this.isAdmin) this.openSupportFor(ownerId);
      else if (this.requestedRoomId && !this.loadingRooms()) this.selectById(this.requestedRoomId);
    });

    this.socket.roomMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(message => this.onRoomMessage(message));
    this.socket.inboxMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(message => this.onListMessage(message));
    this.socket.supportMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(message => this.onListMessage(message));
    this.socket.typingEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.userId !== this.me) this.setTyping(event.roomId, event.userId, event.typing);
    });
    this.loadRooms();
  }

  ngAfterViewChecked(): void {
    const element = this.threadRef?.nativeElement;
    if (!element) return;
    if (this.keepScrollFrom) {
      element.scrollTop = element.scrollHeight - this.keepScrollFrom.height + this.keepScrollFrom.top;
      this.keepScrollFrom = null;
    }
    if (this.scrollToUnread) {
      const divider = element.querySelector<HTMLElement>('.unread-divider');
      if (divider) {
        element.scrollTop += divider.getBoundingClientRect().top - element.getBoundingClientRect().top - 24;
        this.scrollToUnread = false;
        this.scrollBottom = false;
        return;
      }
    }
    if (this.scrollBottom) {
      element.scrollTop = element.scrollHeight;
      this.scrollBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.stopTyping();
    this.listening.forEach(roomId => this.socket.unsubscribeRoom(roomId));
    this.typingTimers.forEach(timer => clearTimeout(timer));
    this.draftImages().forEach(item => URL.revokeObjectURL(item.previewUrl));
    this.localUrls.forEach(url => URL.revokeObjectURL(url));
  }

  // ---- danh sach doan chat ---------------------------------------------------------------------

  loadRooms(): void {
    this.loadingRooms.set(true);
    this.roomsFailed.set(false);
    this.roomsPage = 0;
    this.fetchRooms(0).pipe(finalize(() => this.loadingRooms.set(false))).subscribe({
      next: rooms => {
        this.rooms.set(sortRooms(rooms));
        this.hasMoreRooms.set(rooms.length === ROOM_PAGE);
        this.resolvePeople(rooms);
        this.listen(rooms);
        if (this.requestedRoomId) this.selectById(this.requestedRoomId);
        else if (!this.active() && rooms.length && this.showsListAndThread()) this.select(this.rooms()[0], false);
      },
      error: () => this.roomsFailed.set(true)
    });
  }

  loadMoreRooms(): void {
    if (this.loadingMoreRooms() || !this.hasMoreRooms()) return;
    this.loadingMoreRooms.set(true);
    const page = this.roomsPage + 1;
    this.fetchRooms(page).pipe(finalize(() => this.loadingMoreRooms.set(false))).subscribe({
      next: rooms => {
        const known = new Set(this.rooms().map(room => room.roomId));
        this.roomsPage = page;
        this.hasMoreRooms.set(rooms.length === ROOM_PAGE);
        this.rooms.update(current => sortRooms([...current, ...rooms.filter(room => !known.has(room.roomId))]));
        this.resolvePeople(rooms);
        this.listen(rooms);
      },
      error: () => this.hasMoreRooms.set(false)
    });
  }

  private fetchRooms(page: number): Observable<ChatRoom[]> {
    return this.isAdmin ? this.chat.getSupportInbox(page, ROOM_PAGE) : this.chat.getRooms(OWNER_ROOM_TYPES, page, ROOM_PAGE);
  }

  /** Chu san bam hang ghim "Ho tro GOAT Sports": tao (lan dau) roi mo hop thu ho tro. */
  openOwnSupport(): void {
    if (this.openingSupport()) return;
    this.openingSupport.set(true);
    this.chat.openSupport().pipe(finalize(() => this.openingSupport.set(false))).subscribe({
      next: room => this.adopt(room),
      error: () => this.notify.error('Chưa mở được hộp thư hỗ trợ. Vui lòng thử lại.')
    });
  }

  /** Admin mo (hoac chu dong nhan cho) chu san tu trang khac: `?owner=<id>`. */
  private openSupportFor(ownerId: string): void {
    this.openingSupport.set(true);
    this.chat.openSupport(ownerId).pipe(finalize(() => this.openingSupport.set(false))).subscribe({
      next: room => {
        this.adopt(room);
        void this.router.navigate([], { relativeTo: this.route, queryParams: { room: room.roomId }, replaceUrl: true });
      },
      error: () => this.notify.error('Chưa mở được cuộc trò chuyện với chủ sân này.')
    });
  }

  private adopt(room: ChatRoom): void {
    this.rooms.update(items => sortRooms([room, ...items.filter(item => item.roomId !== room.roomId)]));
    this.resolvePeople([room]);
    this.listen([room]);
    this.select(room);
  }

  private selectById(roomId: string): void {
    const found = this.rooms().find(room => room.roomId === roomId);
    if (found) {
      this.select(found, false);
      return;
    }
    this.chat.getRoom(roomId).subscribe({
      next: room => this.adopt(room),
      error: () => this.notify.error('Không mở được cuộc trò chuyện này.')
    });
  }

  select(room: ChatRoom, updateRoute = true): void {
    if (this.active()?.roomId === room.roomId) return;
    // Admin doc hop thu ho tro ma chua tham gia doan chat: tham gia truoc (server chi cho thanh vien doc tin).
    if (this.isAdmin && room.type === 'SUPPORT' && !room.participants.some(person => person.userId === this.me)) {
      const ownerId = this.ownerOf(room);
      if (ownerId) {
        this.chat.openSupport(ownerId).subscribe({
          next: joined => {
            this.rooms.update(items => items.map(item => item.roomId === joined.roomId ? { ...joined, unreadCount: item.unreadCount } : item));
            this.select({ ...joined, unreadCount: room.unreadCount }, updateRoute);
          },
          error: () => this.notify.error('Chưa mở được cuộc trò chuyện này.')
        });
        return;
      }
    }
    this.stopTyping();
    this.listen([room]);
    this.active.set(room);
    this.contextOpen.set(false);
    this.confirmClear.set(false);
    this.subject.set(null);
    this.loadSubject(room);
    this.loadMessages(room.roomId, room.unreadCount > 0);
    if (room.unreadCount > 0) this.patchRoom(room.roomId, { unreadCount: 0 });
    if (updateRoute) void this.router.navigate([], { relativeTo: this.route, queryParams: { room: room.roomId } });
  }

  backToList(): void {
    this.stopTyping();
    this.active.set(null);
    this.messages.set([]);
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  /** Cung diem gay voi messages.component.scss (820px). */
  private showsListAndThread(): boolean {
    return typeof matchMedia === 'undefined' || matchMedia('(min-width: 821px)').matches;
  }

  // ---- tin nhan --------------------------------------------------------------------------------

  loadMessages(roomId: string, atUnread = false): void {
    const sequence = ++this.messageSequence;
    const pending = this.messages().filter(message => message.roomId === roomId && message.deliveryState !== 'SENT');
    this.loadingMessages.set(true);
    this.messagesFailed.set(false);
    this.messages.set([]);
    this.hasOlder.set(false);
    this.hasNewer.set(false);
    this.firstUnreadId.set(null);
    this.newBelow.set(0);
    this.showJump.set(false);

    const window$ = atUnread
      ? this.chat.getUnreadWindow(roomId, MESSAGE_PAGE)
      : this.chat.getMessagesByCursor(roomId, {}, MESSAGE_PAGE).pipe(map(messages => ({
        messages, firstUnreadMessageId: null, hasOlder: messages.length === MESSAGE_PAGE, hasNewer: false
      })));
    window$.pipe(finalize(() => {
      if (sequence === this.messageSequence) this.loadingMessages.set(false);
    })).subscribe({
      next: window => {
        if (sequence !== this.messageSequence || this.active()?.roomId !== roomId) return;
        const saved = [...window.messages].reverse();
        const unmatched = window.hasNewer ? [] : pending.filter(item => !saved.some(message => message.clientMessageId === item.clientMessageId));
        this.hasOlder.set(window.hasOlder);
        this.hasNewer.set(window.hasNewer);
        this.showJump.set(window.hasNewer);
        this.firstUnreadId.set(window.firstUnreadMessageId);
        this.messages.set(sortMessages([...saved, ...unmatched]));
        if (window.firstUnreadMessageId) this.scrollToUnread = true; else this.scrollBottom = true;
        if (atUnread) this.chat.markRead(roomId).subscribe({ next: () => this.inbox.refresh(), error: () => undefined });
      },
      error: () => {
        if (sequence === this.messageSequence) this.messagesFailed.set(true);
      }
    });
  }

  retryMessages(): void {
    const room = this.active();
    if (room) this.loadMessages(room.roomId);
  }

  loadOlder(): void {
    const room = this.active();
    const oldest = this.messages().find(message => message.deliveryState === 'SENT');
    if (!room || !oldest || this.loadingOlder() || !this.hasOlder()) return;
    this.loadingOlder.set(true);
    const sequence = this.messageSequence;
    this.chat.getMessagesByCursor(room.roomId, { before: oldest.createdAt }, MESSAGE_PAGE)
      .pipe(finalize(() => this.loadingOlder.set(false)))
      .subscribe({
        next: page => {
          if (sequence !== this.messageSequence) return;
          const known = new Set(this.messages().map(message => message.messageId));
          const element = this.threadRef?.nativeElement;
          if (element) this.keepScrollFrom = { height: element.scrollHeight, top: element.scrollTop };
          this.hasOlder.set(page.length === MESSAGE_PAGE);
          this.messages.update(current => sortMessages([...[...page].reverse().filter(item => !known.has(item.messageId)), ...current]));
        },
        error: () => this.hasOlder.set(false)
      });
  }

  loadNewer(): void {
    const room = this.active();
    const list = this.messages();
    const newest = list[list.length - 1];
    if (!room || !newest || this.loadingNewer() || !this.hasNewer()) return;
    this.loadingNewer.set(true);
    const sequence = this.messageSequence;
    this.chat.getMessagesByCursor(room.roomId, { after: newest.createdAt }, MESSAGE_PAGE)
      .pipe(finalize(() => this.loadingNewer.set(false)))
      .subscribe({
        next: page => {
          if (sequence !== this.messageSequence) return;
          const known = new Set(this.messages().map(message => message.messageId));
          const end = page.length < MESSAGE_PAGE;
          this.hasNewer.set(!end);
          if (end) this.newBelow.set(0);
          this.messages.update(current => sortMessages([...current, ...[...page].reverse().filter(item => !known.has(item.messageId))]));
          this.onThreadScroll();
        },
        error: () => this.hasNewer.set(false)
      });
  }

  jumpToLatest(): void {
    const room = this.active();
    if (!room) return;
    if (this.hasNewer()) {
      this.loadMessages(room.roomId);
      return;
    }
    const element = this.threadRef?.nativeElement;
    element?.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }

  onThreadScroll(): void {
    const element = this.threadRef?.nativeElement;
    if (!element) return;
    this.showJump.set(this.hasNewer() || element.scrollHeight - element.scrollTop - element.clientHeight > 480);
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    this.announceTyping(value);
    const area = this.composerRef?.nativeElement;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const room = this.active();
    const content = this.draft().trim();
    const images = this.draftImages();
    if (!room || !this.canSend()) return;
    const clientMessageId = crypto.randomUUID();
    images.forEach(item => this.localUrls.add(item.previewUrl));
    if (images.length) this.outgoingFiles.set(clientMessageId, images.map(item => item.file));
    const optimistic: ChatMessage = {
      messageId: `pending-${clientMessageId}`,
      clientMessageId,
      roomId: room.roomId,
      senderId: this.me,
      content,
      type: images.length ? 'IMAGE' : 'TEXT',
      attachments: images.map((item, index) => ({
        attachmentId: `local-${clientMessageId}-${index}`, storageKey: '', type: 'IMAGE',
        fileName: item.file.name, fileSize: item.file.size, previewUrl: item.previewUrl
      })),
      createdAt: new Date().toISOString(),
      deliveryState: 'SENDING'
    };
    this.draft.set('');
    this.draftImages.set([]);
    this.stopTyping();
    if (this.composerRef) this.composerRef.nativeElement.style.height = '';
    if (this.hasNewer()) {
      this.messages.update(items => [...items, optimistic]);
      this.loadMessages(room.roomId);
    } else {
      this.insert(optimistic);
    }
    this.touchRoom(optimistic);
    this.dispatch(optimistic);
  }

  retry(message: ChatMessage): void {
    if (message.deliveryState !== 'FAILED') return;
    this.patchMessage(message, { deliveryState: 'SENDING' });
    this.dispatch({ ...message, deliveryState: 'SENDING' });
  }

  private dispatch(message: ChatMessage): void {
    const key = message.clientMessageId ?? message.messageId;
    const files = this.outgoingFiles.get(key) ?? [];
    const cached = this.uploadedKeys.get(key);
    const keys$: Observable<string[]> = !files.length ? of([]) : cached ? of(cached) : this.storage.uploadImages(files, 'chat-messages');
    keys$.pipe(switchMap(storageKeys => {
      if (files.length) this.uploadedKeys.set(key, storageKeys);
      return this.chat.sendMessage(message.roomId, {
        clientMessageId: key,
        content: message.content,
        type: message.type,
        attachments: storageKeys.map((storageKey, index) => ({
          storageKey, type: 'IMAGE' as const, fileName: files[index]?.name, fileSize: files[index]?.size
        }))
      });
    })).subscribe({
      next: saved => {
        this.outgoingFiles.delete(key);
        this.uploadedKeys.delete(key);
        this.reconcile({ ...saved, attachments: saved.attachments.map((item, index) => ({ ...item, previewUrl: message.attachments[index]?.previewUrl })) });
        this.touchRoom(saved);
        this.inbox.refresh();
      },
      error: () => {
        this.patchMessage(message, { deliveryState: 'FAILED' });
        this.notify.error(files.length ? 'Ảnh chưa gửi được. Bấm "Gửi lại" ngay trên tin nhắn.' : 'Tin nhắn chưa gửi được. Bấm "Gửi lại" ngay trên tin nhắn.');
      }
    });
  }

  // ---- anh -------------------------------------------------------------------------------------

  async onPickImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.addImages(files);
  }

  onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    void this.addImages(files);
  }

  removeDraftImage(index: number): void {
    const item = this.draftImages()[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    this.draftImages.update(items => items.filter((_, position) => position !== index));
  }

  imageUrl(attachment: ChatMessage['attachments'][number]): string {
    return (attachment.storageKey && this.imageUrls().get(attachment.storageKey)) || attachment.previewUrl || '';
  }

  openImage(url: string): void {
    if (url) window.open(url, '_blank', 'noopener');
  }

  private async addImages(files: File[]): Promise<void> {
    const images = files.filter(file => file.type.startsWith('image/'));
    if (images.length < files.length) this.notify.warning('Chỉ gửi được tệp ảnh.');
    const room = CHAT_MAX_IMAGES - this.draftImages().length;
    if (!images.length) return;
    if (room <= 0) {
      this.notify.warning(`Mỗi tin nhắn gửi tối đa ${CHAT_MAX_IMAGES} ảnh.`);
      return;
    }
    this.preparingImages.set(true);
    try {
      const prepared: { file: File; previewUrl: string }[] = [];
      for (const file of images.slice(0, room)) {
        try {
          const ready = await prepareImage(file);
          if (ready.size > CHAT_MAX_BYTES) {
            this.notify.warning(`Ảnh ${file.name} vẫn lớn hơn 10 MB sau khi nén.`);
            continue;
          }
          prepared.push({ file: ready, previewUrl: URL.createObjectURL(ready) });
        } catch {
          this.notify.warning(`Không đọc được ảnh ${file.name}.`);
        }
      }
      this.draftImages.update(items => [...items, ...prepared]);
    } finally {
      this.preparingImages.set(false);
    }
  }

  private resolveImageUrls(messages: readonly ChatMessage[]): void {
    messages.flatMap(message => message.attachments)
      .filter(item => item.type === 'IMAGE' && item.storageKey && !this.requestedKeys.has(item.storageKey))
      .forEach(item => {
        this.requestedKeys.add(item.storageKey);
        this.storage.getFileUrl(item.storageKey).subscribe({
          next: url => this.imageUrls.update(current => new Map(current).set(item.storageKey, url)),
          error: () => this.requestedKeys.delete(item.storageKey)
        });
      });
  }

  // ---- panel ngu canh ---------------------------------------------------------------------------

  toggleContext(): void {
    this.contextOpen.update(open => !open);
  }

  toggleMute(): void {
    const room = this.active();
    if (!room) return;
    const muted = !room.muted;
    this.patchRoom(room.roomId, { muted });
    this.chat.setMuted(room.roomId, muted).subscribe({
      next: () => this.inbox.refresh(),
      error: () => {
        this.patchRoom(room.roomId, { muted: !muted });
        this.notify.error('Chưa cập nhật được thông báo của đoạn chat.');
      }
    });
  }

  clearChat(): void {
    const room = this.active();
    if (!room || this.clearing()) return;
    this.clearing.set(true);
    this.chat.clearRoom(room.roomId).pipe(finalize(() => this.clearing.set(false))).subscribe({
      next: () => {
        this.confirmClear.set(false);
        this.rooms.update(items => items.filter(item => item.roomId !== room.roomId));
        this.backToList();
        this.inbox.refresh();
        this.notify.success('Đã xóa đoạn chat ở phía bạn.');
      },
      error: () => this.notify.error('Chưa xóa được đoạn chat. Vui lòng thử lại.')
    });
  }

  private loadSubject(room: ChatRoom): void {
    if (room.type !== 'BUSINESS' || !room.subjectId || this.isAdmin) return;
    const roomId = room.roomId;
    const id = room.subjectId;
    const set = (card: SubjectCard) => { if (this.active()?.roomId === roomId) this.subject.set(card); };
    const fallback = (kicker: string, route: string): SubjectCard => ({ icon: 'info', kicker, title: 'Không còn trong danh sách của bạn', meta: '', route });
    if (room.subjectType === 'VENUE') {
      this.venues.getMyVenues().subscribe({
        next: venues => {
          const venue = venues.find(item => item.venueId === id);
          set(venue
            ? { icon: 'land-plot', kicker: 'Cơ sở', title: venue.name, meta: [venue.district, venue.city].filter(Boolean).join(', '), route: '/admin/venues' }
            : fallback('Cơ sở', '/admin/venues'));
        },
        error: () => set(fallback('Cơ sở', '/admin/venues'))
      });
    } else if (room.subjectType === 'TOURNAMENT') {
      this.tournaments.get(id).subscribe({
        next: tournament => set({ icon: 'trophy', kicker: 'Giải đấu', title: tournament.name, meta: formatDate(tournament.startDate), route: `/admin/tournaments/${id}` }),
        error: () => set(fallback('Giải đấu', '/admin/tournaments'))
      });
    } else if (room.subjectType === 'BOOKING') {
      this.bookings.getBooking(id).subscribe({
        next: booking => set({
          icon: 'ticket', kicker: `Vé ${booking.bookingCode}`, title: `${booking.courtName} · ${booking.venueName}`,
          meta: `${booking.startTime.slice(0, 5)}–${booking.endTime.slice(0, 5)}, ${formatDate(booking.playDate)}`,
          route: '/admin/owner-bookings', query: { query: booking.bookingCode }
        }),
        error: () => set(fallback('Vé đặt sân', '/admin/owner-bookings'))
      });
    }
  }

  // ---- hien thi ---------------------------------------------------------------------------------

  /** Nguoi o phia ben kia: khach (chu san xem BUSINESS) hoac chu san (admin xem SUPPORT). */
  counterpartId(room: ChatRoom): string | undefined {
    if (room.type === 'SUPPORT') return this.isAdmin ? this.ownerOf(room) : undefined;
    return room.participants.find(person => person.userId !== this.me)?.userId;
  }

  roomName(room: ChatRoom): string {
    if (room.type === 'SUPPORT' && !this.isAdmin) return 'Hỗ trợ GOAT Sports';
    const id = this.counterpartId(room);
    return (id && this.people().get(id)?.name) || room.name || 'Người dùng GOAT';
  }

  roomAvatar(room: ChatRoom): string {
    if (room.type === 'SUPPORT' && !this.isAdmin) return SUPPORT_AVATAR;
    const id = this.counterpartId(room);
    return (id && this.people().get(id)?.avatar) || '';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'G';
  }

  roomBadge(room: ChatRoom): string {
    if (room.type === 'SUPPORT') return this.isAdmin ? '' : 'Hỗ trợ';
    return room.subjectType === 'TOURNAMENT' ? 'Giải' : room.subjectType === 'BOOKING' ? 'Vé' : 'Sân';
  }

  roomContext(room: ChatRoom): string {
    if (room.type === 'SUPPORT') return this.isAdmin ? 'Chủ sân · hộp thư hỗ trợ' : 'Đội quản trị GOAT Sports';
    if (room.subjectType === 'TOURNAMENT') return 'Khách hỏi về giải đấu của bạn';
    if (room.subjectType === 'BOOKING') return 'Khách hỏi về vé đặt sân';
    return 'Khách hỏi về cơ sở của bạn';
  }

  preview(room: ChatRoom): string {
    if (!room.lastMessage) return room.type === 'SUPPORT' && !this.isAdmin ? 'Nhắn cho đội quản trị GOAT Sports' : 'Chưa có tin nhắn';
    return room.lastSenderId === this.me ? `Bạn: ${room.lastMessage}` : room.lastMessage;
  }

  timeLabel(room: ChatRoom): string {
    const value = room.lastMessageAt || room.updatedAt;
    if (!value) return '';
    const date = new Date(value);
    const days = daysFromToday(date);
    if (days === 0) return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
    if (days === 1) return 'Hôm qua';
    if (days < 7) return new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
  }

  person(id: string | undefined): Person | undefined {
    return id ? this.people().get(id) : undefined;
  }

  /** Ten nguoi gui o dau chuoi tin: hop thu ho tro co nhieu admin, chu san can biet ai tra loi. */
  senderLabel(message: ChatMessage): string {
    const room = this.active();
    if (!room || room.type !== 'SUPPORT' || message.senderId === this.me) return '';
    const name = this.people().get(message.senderId)?.name ?? '';
    const role = room.participants.find(person => person.userId === message.senderId)?.role;
    return role === 'ADMIN' ? `${name || 'Quản trị viên'} · Quản trị viên` : name;
  }

  daySeparator(index: number): string {
    const list = this.messages();
    const current = list[index];
    const previous = list[index - 1];
    if (!current) return '';
    const date = new Date(current.createdAt);
    if (previous && isSameDay(new Date(previous.createdAt), date)) return '';
    const full = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const days = daysFromToday(date);
    if (days === 0) return `Hôm nay, ${full}`;
    if (days === 1) return `Hôm qua, ${full}`;
    const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${full}`;
  }

  isFirstOfRun(index: number): boolean {
    const list = this.messages();
    const current = list[index];
    const previous = list[index - 1];
    return !previous || previous.senderId !== current.senderId || !isSameDay(new Date(previous.createdAt), new Date(current.createdAt))
      || new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60_000;
  }

  isLastOfRun(index: number): boolean {
    const list = this.messages();
    const current = list[index];
    const next = list[index + 1];
    return !next || next.senderId !== current.senderId || !isSameDay(new Date(next.createdAt), new Date(current.createdAt))
      || new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime() > 5 * 60_000;
  }

  messageTime(message: ChatMessage): string {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
  }

  deliveryIcon(message: ChatMessage): string {
    if (message.deliveryState === 'SENDING') return 'clock-3';
    if (message.deliveryState === 'FAILED') return 'circle-alert';
    return 'check-check';
  }

  ownerOf(room: ChatRoom): string | undefined {
    return room.participants.find(person => person.role === 'OWNER')?.userId;
  }

  // ---- realtime + cap nhat trang thai ------------------------------------------------------------

  private onRoomMessage(message: ChatMessage): void {
    this.setTyping(message.roomId, message.senderId, false);
    const active = this.active();
    if (active?.roomId === message.roomId) {
      if (this.hasNewer() && message.senderId !== this.me) {
        this.newBelow.update(count => count + 1);
      } else {
        this.reconcile(message);
      }
      if (message.senderId !== this.me) this.chat.markRead(message.roomId).subscribe({ next: () => this.inbox.refresh(), error: () => undefined });
    }
    this.touchRoom(message);
  }

  private onListMessage(message: ChatMessage): void {
    // Phong dang nghe da nhan tin qua kenh cua phong (onRoomMessage); kenh rieng chi lo phong moi / chua tham gia.
    if (this.listening.has(message.roomId)) return;
    this.touchRoom(message);
  }

  private touchRoom(message: ChatMessage): void {
    const room = this.rooms().find(item => item.roomId === message.roomId);
    if (!room) {
      this.loadRooms();
      return;
    }
    const images = message.attachments.length;
    const isActive = this.active()?.roomId === message.roomId;
    const fromOwner = room.type === 'SUPPORT' && message.senderId === this.ownerOf(room);
    this.patchRoom(message.roomId, {
      lastMessage: message.content || (images === 1 ? 'Đã gửi một ảnh' : images > 1 ? `Đã gửi ${images} ảnh` : ''),
      lastMessageAt: message.createdAt,
      lastSenderId: message.senderId,
      awaitingReply: room.type === 'SUPPORT' ? fromOwner : room.awaitingReply,
      unreadCount: !isActive && message.senderId !== this.me && message.deliveryState === 'SENT' ? room.unreadCount + 1 : room.unreadCount
    });
  }

  private patchRoom(roomId: string, changes: Partial<ChatRoom>): void {
    this.rooms.update(items => sortRooms(items.map(item => item.roomId === roomId ? { ...item, ...changes } : item)));
    if (this.active()?.roomId === roomId) this.active.update(room => room ? { ...room, ...changes } : room);
  }

  private insert(message: ChatMessage): void {
    if (this.messages().some(item => item.messageId === message.messageId
      || (message.clientMessageId && item.clientMessageId === message.clientMessageId))) return;
    this.messages.update(items => sortMessages([...items, message]));
    this.scrollBottom = true;
  }

  private reconcile(message: ChatMessage): void {
    const saved = { ...message, deliveryState: 'SENT' as const };
    const index = this.messages().findIndex(item => item.messageId === message.messageId
      || (message.clientMessageId && item.clientMessageId === message.clientMessageId));
    if (index < 0) {
      this.insert(saved);
      return;
    }
    this.messages.update(items => items.map((item, position) => position === index
      ? { ...saved, attachments: saved.attachments.map((attachment, slot) => ({ ...attachment, previewUrl: attachment.previewUrl ?? item.attachments[slot]?.previewUrl })) }
      : item));
    this.scrollBottom = true;
  }

  private patchMessage(message: ChatMessage, changes: Partial<ChatMessage>): void {
    this.messages.update(items => items.map(item => item.messageId === message.messageId
      || (message.clientMessageId && item.clientMessageId === message.clientMessageId) ? { ...item, ...changes } : item));
  }

  // ---- dang nhap (typing) ------------------------------------------------------------------------

  /** Ten nguoi dang nhap o phong dang mo, vd. "Minh Anh đang nhập". */
  typingLabel(roomId: string): string {
    const ids = this.typing().get(roomId) ?? [];
    if (!ids.length) return '';
    const names = ids.map(id => this.people().get(id)?.name?.split(' ').slice(-2).join(' ') || 'Ai đó');
    return names.length === 1 ? `${names[0]} đang nhập` : `${names.slice(0, 2).join(' và ')} đang nhập`;
  }

  typingUsers(roomId: string): readonly string[] {
    return this.typing().get(roomId) ?? [];
  }

  /** Nghe tin moi va "dang nhap" cua cac phong minh la thanh vien (admin chua tham gia hop thu thi server tu choi). */
  private listen(rooms: readonly ChatRoom[]): void {
    rooms.filter(room => room.participants.some(person => person.userId === this.me) && !this.listening.has(room.roomId))
      .forEach(room => {
        this.listening.add(room.roomId);
        this.socket.subscribeRoom(room.roomId);
      });
  }

  /** Go chu: bao "dang nhap" mot lan, ngung sau 2,5s khong go; xoa het chu thi ngung ngay. */
  private announceTyping(value: string): void {
    const room = this.active();
    if (!room) return;
    if (!value.trim()) {
      this.stopTyping();
      return;
    }
    if (this.typingRoom !== room.roomId) {
      this.stopTyping();
      this.typingRoom = room.roomId;
      this.socket.sendTyping(room.roomId, true);
    }
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  private stopTyping(): void {
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = null;
    if (!this.typingRoom) return;
    this.socket.sendTyping(this.typingRoom, false);
    this.typingRoom = null;
  }

  private setTyping(roomId: string, userId: string, typing: boolean): void {
    const key = `${roomId}:${userId}`;
    const timer = this.typingTimers.get(key);
    if (timer) clearTimeout(timer);
    this.typingTimers.delete(key);
    const current = this.typing().get(roomId) ?? [];
    const next = typing ? [...current.filter(id => id !== userId), userId] : current.filter(id => id !== userId);
    if (next.length === current.length && next.every((id, index) => id === current[index])) return;
    const followBottom = typing && this.active()?.roomId === roomId && this.isNearBottom();
    this.typing.update(map => {
      const copy = new Map(map);
      if (next.length) copy.set(roomId, next); else copy.delete(roomId);
      return copy;
    });
    if (followBottom) this.scrollBottom = true;
    if (typing) this.typingTimers.set(key, setTimeout(() => this.setTyping(roomId, userId, false), 4500));
  }

  private isNearBottom(): boolean {
    const element = this.threadRef?.nativeElement;
    return !!element && element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  /** Ten + anh + email nguoi trong cac doan chat (auth-service), nap mot lan moi nguoi. */
  private resolvePeople(rooms: readonly ChatRoom[]): void {
    const ids = [...new Set(rooms.flatMap(room => room.participants.map(person => person.userId)))]
      .filter(id => id && !this.requestedPeople.has(id));
    ids.forEach(id => {
      this.requestedPeople.add(id);
      this.users.getUserById(id).subscribe({
        next: (user: User) => this.people.update(current => new Map(current).set(id, {
          name: user.fullName || user.username || 'Người dùng GOAT',
          avatar: getAvatarUrl(user.avatarUrl),
          email: user.email,
          phone: user.phone
        })),
        error: () => undefined
      });
    });
  }
}

function sortRooms(rooms: ChatRoom[]): ChatRoom[] {
  const time = (room: ChatRoom) => new Date(room.lastMessageAt || room.updatedAt || room.createdAt).getTime();
  return [...rooms].sort((left, right) => time(right) - time(left));
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function daysFromToday(date: Date): number {
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return Math.round((start(new Date()) - start(date)) / 86_400_000);
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

