import {
  FeePaymentStatus, RegistrationStatus, TournamentFormat, TournamentSport, TournamentStatus
} from '@application/dto/owner-tournament/owner-tournament.dto';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

export const SPORT_LABEL: Readonly<Record<TournamentSport, string>> = {
  FOOTBALL: 'Bóng đá', BADMINTON: 'Cầu lông', TENNIS: 'Tennis',
  PICKLEBALL: 'Pickleball', BASKETBALL: 'Bóng rổ', VOLLEYBALL: 'Bóng chuyền'
};

/** Ma mon cua san (venue-service) trung ma mon cua giai. */
export const SPORTS = Object.keys(SPORT_LABEL) as TournamentSport[];

export const FORMAT_LABEL: Readonly<Record<TournamentFormat, string>> = {
  SINGLE_ELIMINATION: 'Loại trực tiếp', ROUND_ROBIN: 'Vòng tròn'
};

export const STATUS_META: Readonly<Record<TournamentStatus, { label: string; tone: Tone }>> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PUBLISHED: { label: 'Sắp mở đăng ký', tone: 'info' },
  REGISTRATION_OPEN: { label: 'Đang mở đăng ký', tone: 'success' },
  REGISTRATION_CLOSED: { label: 'Đã đóng đăng ký', tone: 'warning' },
  IN_PROGRESS: { label: 'Đang diễn ra', tone: 'primary' },
  COMPLETED: { label: 'Đã kết thúc', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' }
};

export const REGISTRATION_META: Readonly<Record<RegistrationStatus, { label: string; tone: Tone }>> = {
  PENDING_MEMBERS: { label: 'Chờ đủ người', tone: 'info' },
  PENDING_ELIGIBILITY: { label: 'Chờ xét điều kiện', tone: 'warning' },
  PENDING_PAYMENT: { label: 'Chờ đóng phí', tone: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' }
};

export const PAYMENT_META: Readonly<Record<FeePaymentStatus, { label: string; tone: Tone }>> = {
  PENDING: { label: 'Chưa thanh toán', tone: 'warning' },
  SUCCEEDED: { label: 'Đã thu', tone: 'success' },
  FAILED: { label: 'Thanh toán lỗi', tone: 'danger' },
  WAIVED: { label: 'Miễn phí', tone: 'neutral' },
  REFUND_REQUESTED: { label: 'Đang hoàn phí', tone: 'info' }
};

export const HOLDING: ReadonlySet<RegistrationStatus> =
  new Set(['PENDING_MEMBERS', 'PENDING_ELIGIBILITY', 'PENDING_PAYMENT', 'CONFIRMED']);

export function formatVnd(amount: number | null | undefined): string {
  if (!amount) return 'Miễn phí';
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
}

export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export function timeOf(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Cung cong thuc voi TournamentCapacityPolicy (club-service): san x ngay x so tran vua khung gio,
 * so voi so tran toi da khi du suat. Hien truoc de chu san khong phai doi loi tu server.
 */
export function capacity(format: TournamentFormat, participants: number, courts: number, startDate: string,
                         endDate: string, dailyStart: string, dailyEnd: string, matchMinutes: number) {
  const required = participants < 2 ? 0
    : format === 'ROUND_ROBIN' ? participants * (participants - 1) / 2 : participants - 1;
  const days = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1) : 0;
  const window = dailyStart && dailyEnd ? minutesOf(dailyEnd) - minutesOf(dailyStart) : 0;
  const perCourtPerDay = matchMinutes > 0 && window > 0 ? Math.floor(window / matchMinutes) : 0;
  const available = perCourtPerDay * courts * days;
  return { required, available, enough: available >= required };
}
