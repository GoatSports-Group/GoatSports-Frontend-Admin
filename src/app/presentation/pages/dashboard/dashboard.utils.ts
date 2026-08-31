import {
  OwnerApplication,
  OwnerApplicationStatus
} from '@application/dto/owner-application/owner-application.dto';
import { CalendarGrid, DistrictBreakdownItem, VenueMapMarker } from './dashboard.models';

export const HCM_CENTER: [number, number] = [10.7760, 106.7009];

const VIETNAMESE_WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy'
];

export function formatVietnameseDate(date: Date): string {
  const dayName = VIETNAMESE_WEEKDAYS[date.getDay()];
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${dayName}, ngày ${day} tháng ${month} năm ${date.getFullYear()}`;
}

export function formatVietnameseMonthYear(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `Tháng ${month} năm ${date.getFullYear()}`;
}

export function buildDistrictBreakdown(districts: string[]): DistrictBreakdownItem[] {
  const counts = districts.reduce<Record<string, number>>((result, district) => {
    const name = district.replace(/(quận|q\.|q)/i, '').trim() || 'Khác';
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .map(([key, count]) => ({
      name: isNaN(Number(key)) ? key : `Quận ${key}`,
      count
    }))
    .sort((a, b) => b.count - a.count);
}

export function createVenueMapMarker(app: OwnerApplication, index: number): VenueMapMarker {
  const rawLat = app.address?.latitude;
  const rawLng = app.address?.longitude;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const hasCoordinates = rawLat != null
    && rawLng != null
    && hasValidCoordinates(lat, lng);
  const district = app.address?.district?.trim() || 'Chưa xác định';
  const addressParts = [
    app.address?.address,
    app.address?.ward,
    district,
    app.address?.city
  ].map(part => part?.trim()).filter((part): part is string => Boolean(part));
  const fallbackCoordinates = getHcmFallbackCoordinates(index);

  return {
    lat: hasCoordinates ? lat : fallbackCoordinates[0],
    lng: hasCoordinates ? lng : fallbackCoordinates[1],
    businessName: app.businessName,
    fullName: app.fullName,
    addressText: [...new Set(addressParts)].join(', ') || 'Chưa có thông tin địa chỉ',
    status: app.status,
    district,
    isFallback: !hasCoordinates
  };
}

export function getVenueMarkerColor(status: OwnerApplicationStatus): string {
  if (status === OwnerApplicationStatus.PENDING) return '#f59e0b';
  if (status === OwnerApplicationStatus.REJECTED) return '#ef4444';
  return '#10b981';
}

export function buildVenueTooltipContent(marker: VenueMapMarker): string {
  const locationNotice = marker.isFallback
    ? '<span class="block text-[10px] text-amber-600 font-bold leading-snug mt-1">Chưa xác định được vị trí sân.</span>'
    : '';

  return `
    <div class="p-2 select-none font-display">
      <strong class="block text-xs font-black text-emerald-600">${escapeHtml(marker.businessName)}</strong>
      <span class="block text-[12px] text-slate-500 font-bold mt-0.5">Chủ sở hữu: ${escapeHtml(marker.fullName)}</span>
      <span class="block text-[10px] text-slate-500 font-medium leading-snug mt-1">${escapeHtml(marker.addressText)}</span>
      ${locationNotice}
    </div>
  `;
}

export function createCalendarGrid(date: Date): CalendarGrid {
  const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfWeek = new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  return {
    currentDay: date.getDate(),
    offsetCells: Array(startDayOfWeek).fill(null),
    days: Array.from({ length: totalDays }, (_, index) => index + 1)
  };
}

function getHcmFallbackCoordinates(index: number): [number, number] {
  if (index === 0) return HCM_CENTER;

  const position = index - 1;
  const pointsPerRing = 8;
  const ring = Math.floor(position / pointsPerRing) + 1;
  const angle = (position % pointsPerRing) * (Math.PI * 2 / pointsPerRing);
  const radius = Math.min(0.03, ring * 0.006);

  return [
    HCM_CENTER[0] + Math.sin(angle) * radius,
    HCM_CENTER[1] + Math.cos(angle) * radius
  ];
}

function hasValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && !(lat === 0 && lng === 0);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character] || character);
}
