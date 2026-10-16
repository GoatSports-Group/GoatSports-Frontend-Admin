/** Phần tính toán thuần của dashboard cộng đồng (tách khỏi component để test không cần TestBed). */

export const SPORT_LABEL: Record<string, string> = {
  FOOTBALL: 'Bóng đá', BADMINTON: 'Cầu lông', PICKLEBALL: 'Pickleball', TENNIS: 'Tennis',
  BASKETBALL: 'Bóng rổ', VOLLEYBALL: 'Bóng chuyền'
};

export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const WEEKDAY_LONG = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

/** Số bậc màu của heatmap (bậc 0 = không có hoạt động). */
export const HEAT_LEVELS = 5;

/**
 * Đường và vùng của biểu đồ theo ngày trong khung 100 × 100 (viewBox, kéo giãn theo khung).
 * Trần là giá trị cao nhất (tối thiểu 1); một điểm duy nhất vẽ thành đoạn ngang.
 */
export function linePaths(values: readonly number[]): { line: string; area: string; max: number; points: { x: number; y: number }[] } {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: values.length > 1 ? (index / (values.length - 1)) * 100 : 50,
    y: 100 - (value / max) * 100
  }));
  if (!points.length) return { line: '', area: '', max, points };
  const drawn = points.length === 1 ? [{ x: 0, y: points[0].y }, { x: 100, y: points[0].y }] : points;
  const line = drawn.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  return { line, area: `${line} L${drawn[drawn.length - 1].x.toFixed(2)},100 L${drawn[0].x.toFixed(2)},100 Z`, max, points };
}

/** Bậc màu 0..HEAT_LEVELS: 0 chỉ khi không có hoạt động; còn lại chia đều theo ô cao nhất (ô > 0 ít nhất bậc 1). */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(HEAT_LEVELS, Math.max(1, Math.ceil((count / max) * HEAT_LEVELS)));
}

export type Tone = 'good' | 'bad' | 'flat';
export interface Delta { text: string; tone: Tone; icon: string }

/** Chênh lệch % so với kỳ trước; kỳ trước 0 mà kỳ này có số thì không so được (null). */
export function changeOf(current: number | null | undefined, previous: number | null | undefined): Delta | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? { text: 'Như kỳ trước', tone: 'flat', icon: 'minus' } : null;
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) return { text: 'Như kỳ trước', tone: 'flat', icon: 'minus' };
  const up = change > 0;
  return {
    text: `${up ? '+' : '−'}${Math.abs(change).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước`,
    tone: up ? 'good' : 'bad', icon: up ? 'trending-up' : 'trending-down'
  };
}

/** Khung giờ đông nhất (ô cao nhất, hòa thì ô đầu tiên theo thứ → giờ). */
export function peakCell<T extends { dayOfWeek: number; hour: number; count: number }>(cells: readonly T[]): T | null {
  return cells.reduce<T | null>((best, cell) => cell.count > (best?.count ?? 0) ? cell : best, null);
}
