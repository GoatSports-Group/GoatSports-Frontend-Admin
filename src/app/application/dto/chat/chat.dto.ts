/**
 * Tin nhan trong admin: chat cong viec (BUSINESS, khach <-> chu san / ban to chuc giai) va hop thu ho tro
 * (SUPPORT, chu san <-> doi quan tri). Cung API social-service voi trang Tin nhan ben client.
 */
export type ChatRoomType = 'DIRECT' | 'GROUP' | 'CLUB' | 'MATCH' | 'TOURNAMENT' | 'BUSINESS' | 'SUPPORT';

/** Doi tuong khach dang hoi trong chat BUSINESS. */
export type ChatSubjectType = 'VENUE' | 'TOURNAMENT' | 'BOOKING';

export interface ChatParticipant {
  userId: string;
  /** OWNER = chu san (BUSINESS) / chu hop thu (SUPPORT); ADMIN = quan tri vien da tham gia hop thu. */
  role?: string;
  userName?: string;
  userAvatar?: string;
  leftAt?: string;
}

export interface ChatRoom {
  roomId: string;
  type: ChatRoomType;
  name?: string;
  subjectType?: ChatSubjectType;
  subjectId?: string;
  /** Hop thu SUPPORT: tin cuoi do chu san gui, doi quan tri chua tra loi. */
  awaitingReply: boolean;
  participants: ChatParticipant[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount: number;
  muted: boolean;
  blockState: 'BLOCKED_BY_ME' | 'BLOCKED_BY_THEM' | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  attachmentId: string;
  storageKey: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  /** Anh vua chon / vua gui (blob URL) de hien ngay truoc khi co URL ky han that. */
  previewUrl?: string;
}

export type ChatDeliveryState = 'SENDING' | 'SENT' | 'FAILED';

export interface ChatMessage {
  messageId: string;
  roomId: string;
  senderId: string;
  clientMessageId?: string;
  content: string;
  type: string;
  status?: string;
  attachments: ChatAttachment[];
  createdAt: string;
  deliveryState?: ChatDeliveryState;
}

/** Cua so mo doan chat tai tin chua doc dau tien (moi nhat truoc). */
export interface ChatMessageWindow {
  messages: ChatMessage[];
  firstUnreadMessageId: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
}

export interface SendChatMessage {
  clientMessageId: string;
  content: string;
  type: string;
  attachments: { storageKey: string; type: 'IMAGE'; fileName?: string; fileSize?: number }[];
}
